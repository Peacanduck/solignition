/**
 * Projects resource (v1) — multi-program deployments.
 *
 *   POST /v1/projects                          — record a bundled N-loan request
 *   GET  /v1/projects/:projectId               — aggregate status (+ per program)
 *   GET  /v1/projects?borrower=…&…             — list (paginated, lightweight)
 *   POST /v1/projects/:projectId/repayments    — record a bundled N-loan repay
 *
 * A "project" bundles 2–4 program loans the borrower created in ONE signed
 * transaction. Grouping is purely off-chain metadata: each program stays its
 * own on-chain Loan + DeploymentRecord (the single source of truth for deploy
 * status). These endpoints are additive — single-program borrows keep using
 * /v1/loans and never create a ProjectRecord.
 *
 * Every per-program side effect (deploy kick-off, authority transfer) is
 * scheduled independently and individually `.catch`-wrapped, so one program
 * failing never blocks the rest — mirrors the per-loan handlers in loans.ts.
 */
import type { Application, Request } from 'express';
import { PublicKey } from '@solana/web3.js';

import { httpError } from '../error-handler';
import {
  CreateProjectBody,
  CreateProjectResponse,
  CreateProjectRepaymentBody,
  PaginatedProjects,
  ProjectAggregateResponse,
  ProjectIdParam,
  ProjectListQuery,
  ProjectRepaymentResponse,
} from '../schemas';
import { route } from '../route-wrapper';
import { registry as openapi } from '../openapi';
import { loanStatusFor } from './loans';
import type { ProjectProgramRef, ProjectRecord, RouteDeps } from './types';

type ProgramLoanStatus = ReturnType<typeof loanStatusFor>['status'];
type ProjectStatus = 'pending' | 'deploying' | 'partial' | 'deployed' | 'failed';

/**
 * Combine N per-program loan statuses into one project status. Pure — unit
 * tested without a DB. A program is a terminal success when its deployment
 * reached `deployed` (or the loan was later `repaid`), a terminal failure when
 * `failed`/`expired`, and otherwise still in flight.
 *
 *   all success                  → deployed
 *   all failure                  → failed
 *   mixed terminal (some of each) → partial
 *   anything still in flight      → deploying
 *   nothing started              → pending
 */
export function aggregateProjectStatus(statuses: ProgramLoanStatus[]): ProjectStatus {
  if (statuses.length === 0) return 'pending';
  const n = statuses.length;
  const success = statuses.filter((s) => s === 'deployed' || s === 'repaid').length;
  const failure = statuses.filter((s) => s === 'failed' || s === 'expired').length;
  const inProgress = statuses.filter((s) => s === 'deploying' || s === 'uploading').length;

  if (success === n) return 'deployed';
  if (failure === n) return 'failed';
  // Everything settled, but a mix of wins and losses.
  if (inProgress === 0 && success > 0 && failure > 0 && success + failure === n) return 'partial';
  // Some work done or underway, but not all programs are terminal yet.
  if (inProgress > 0 || success > 0 || failure > 0) return 'deploying';
  return 'pending';
}

/**
 * Authz check shared by every project handler: when a pubkey is authenticated,
 * it must match the project/body owner. Same shape as the loans/deployments
 * guards (kept local so route files don't depend on each other).
 */
function assertAuthMatches(
  req: Request,
  owner: string,
  endpoint: string,
  logger: RouteDeps['logger'],
): void {
  if (req.authPubkey && req.authPubkey !== owner) {
    logger.warn('authz_mismatch', {
      endpoint,
      authPubkey: req.authPubkey,
      owner,
      reqId: req.id,
    });
    throw httpError.forbidden(
      'Authenticated pubkey does not match resource owner',
      'authz_mismatch',
    );
  }
}

/** Read every program's deployment record and derive its loan status. */
async function statusesFor(
  deps: RouteDeps,
  programs: ProjectProgramRef[],
): Promise<Array<{ ref: ProjectProgramRef; status: ProgramLoanStatus; deployment: Awaited<ReturnType<RouteDeps['stateManager']['getDeployment']>> }>> {
  return Promise.all(
    programs.map(async (ref) => {
      const deployment = await deps.stateManager.getDeployment(ref.loanId);
      return { ref, status: loanStatusFor(deployment).status, deployment };
    }),
  );
}

export function registerProjectRoutes(app: Application, deps: RouteDeps): void {
  // ── POST /v1/projects ─────────────────────────────────────────────────
  openapi.registerPath({
    method: 'post',
    path: '/v1/projects',
    summary: 'Record a bundled multi-program loan request',
    description:
      'Called by the borrower after they signed ONE transaction containing N (2–4) `request_loan` instructions. Validates each fileId belongs to the borrower, stores the off-chain grouping, then kicks off each program deployment independently. The client-supplied `projectId` (UUID) makes a re-POST idempotent. Does not replace POST /v1/loans (used for single-program borrows).',
    tags: ['projects'],
    security: [{ solignitionAuth: [] }],
    request: { body: { content: { 'application/json': { schema: CreateProjectBody } } } },
    responses: {
      201: {
        description: 'Project recorded; per-program deployments will begin asynchronously',
        content: { 'application/json': { schema: CreateProjectResponse } },
      },
    },
  });
  app.post(
    '/v1/projects',
    deps.rateLimit.notifyIp,
    deps.authMw('POST /v1/projects'),
    deps.rateLimit.notifyPubkey,
    route(
      { body: CreateProjectBody, response: CreateProjectResponse, status: 201 },
      async ({ body, req }) => {
        const { projectId, borrower, signature, name, programs } = body;
        assertAuthMatches(req, borrower, 'POST /v1/projects', deps.logger);

        // Idempotent re-POST: same id + same owner returns the stored record
        // without re-scheduling. A different owner on the same id is a conflict.
        const existing = await deps.stateManager.getProject(projectId);
        if (existing) {
          if (existing.borrower !== borrower) {
            throw httpError.conflict(
              'projectId already exists for a different borrower',
              'project_conflict',
            );
          }
          deps.logger.info('projects.create.idempotent', { projectId, borrower, reqId: req.id });
          return {
            success: true as const,
            message: 'Project already recorded.',
            projectId,
            signature: existing.signature,
            programs: existing.programs,
          };
        }

        // Validate every fileId belongs to this borrower before we store
        // anything (same checks as POST /v1/loans, per program).
        const fileUploads = await Promise.all(
          programs.map(async (p) => {
            const upload = await deps.stateManager.getFileUpload(p.fileId);
            if (!upload) {
              deps.logger.error('projects.create.upload_missing', {
                borrower,
                fileId: p.fileId,
                reqId: req.id,
              });
              throw httpError.notFound(
                `No file upload found for fileId ${p.fileId}. Upload first.`,
                'upload_not_found',
              );
            }
            if (upload.borrower !== borrower) {
              throw httpError.forbidden(
                `fileId ${p.fileId} belongs to a different borrower`,
                'upload_borrower_mismatch',
              );
            }
            return upload;
          }),
        );

        const now = Date.now();
        const refs: ProjectProgramRef[] = programs.map((p, index) => ({
          loanId: p.loanId,
          fileId: p.fileId,
          index,
          ...(p.name ? { name: p.name } : {}),
        }));
        const record: ProjectRecord = {
          projectId,
          borrower,
          ...(name ? { name } : {}),
          signature,
          programs: refs,
          createdAt: now,
          updatedAt: now,
        };
        await deps.stateManager.saveProject(record);

        deps.logger.info('projects.create.received', {
          projectId,
          borrower,
          signature,
          programCount: refs.length,
          reqId: req.id,
        });

        // Process each program independently — one failing must not block the
        // others. Same 2s delay + per-call .catch as POST /v1/loans.
        setTimeout(() => {
          refs.forEach((ref, i) => {
            deps
              .processLoanFromSignature(signature, borrower, fileUploads[i], ref.loanId)
              .catch((err) =>
                deps.logger.error('projects.create.process_failed', {
                  projectId,
                  loanId: ref.loanId,
                  signature,
                  borrower,
                  err,
                }),
              );
          });
        }, 2000);

        return {
          success: true as const,
          message: 'Project notification received. Deployments will begin shortly.',
          projectId,
          signature,
          programs: refs,
        };
      },
    ),
  );

  // ── GET /v1/projects/:projectId ───────────────────────────────────────
  // PUBLIC (no auth): a status read keyed by an unguessable client UUID — a
  // capability URL. The data it exposes (deploy status, on-chain program ids)
  // is no more sensitive than the loans, which are already public on-chain.
  // Public so the frontend can poll live deploy progress without prompting the
  // wallet to sign on every poll.
  openapi.registerPath({
    method: 'get',
    path: '/v1/projects/{projectId}',
    summary: 'Get a project with aggregate + per-program status (public)',
    description:
      'Public, keyed by the unguessable project UUID. Aggregates the per-program deployment records into one project status (pending | deploying | partial | deployed | failed) and returns each program enriched with its own loan status + deployment record. No auth so clients can poll live deploy progress.',
    tags: ['projects'],
    request: { params: ProjectIdParam },
    responses: {
      200: {
        description: 'Project aggregate',
        content: { 'application/json': { schema: ProjectAggregateResponse } },
      },
    },
  });
  app.get(
    '/v1/projects/:projectId',
    deps.rateLimit.getIp,
    route(
      { params: ProjectIdParam, response: ProjectAggregateResponse },
      async ({ params }) => {
        const project = await deps.stateManager.getProject(params.projectId);
        if (!project) throw httpError.notFound('Project not found', 'project_not_found');

        const enriched = await statusesFor(deps, project.programs);
        return {
          project,
          status: aggregateProjectStatus(enriched.map((e) => e.status)),
          programs: enriched.map(({ ref, status, deployment }) => ({
            loanId: ref.loanId,
            fileId: ref.fileId,
            index: ref.index,
            ...(ref.name ? { name: ref.name } : {}),
            status,
            deployment,
          })),
        };
      },
    ),
  );

  // ── GET /v1/projects?borrower=…&limit=…&offset=… ──────────────────────
  // PUBLIC (no auth): `borrower` is required and scopes the list. The grouping
  // joins loans that are already public on-chain; public so the dashboard can
  // load groupings without prompting the wallet to sign.
  openapi.registerPath({
    method: 'get',
    path: '/v1/projects',
    summary: 'List a borrower’s projects (paginated, public)',
    description:
      'Public. `borrower` is required and scopes the list. Default limit 50, max 200. Each entry carries a lightweight aggregate status (no per-program deployment records — fetch GET /v1/projects/:projectId for those).',
    tags: ['projects'],
    request: { query: ProjectListQuery },
    responses: {
      200: {
        description: 'Page of projects',
        content: { 'application/json': { schema: PaginatedProjects } },
      },
    },
  });
  app.get(
    '/v1/projects',
    deps.rateLimit.getIp,
    route(
      { query: ProjectListQuery, response: PaginatedProjects },
      async ({ query }) => {
        const { limit, offset, borrower } = query;
        if (!borrower) {
          throw httpError.badRequest('borrower query parameter is required', 'borrower_required');
        }

        const page = await deps.stateManager.getProjectsPage({ borrower, limit, offset });
        const summaries = await Promise.all(
          page.projects.map(async (project) => {
            const enriched = await statusesFor(deps, project.programs);
            return { project, status: aggregateProjectStatus(enriched.map((e) => e.status)) };
          }),
        );
        return {
          projects: summaries,
          total: page.total,
          limit,
          offset,
          hasMore: page.hasMore,
        };
      },
    ),
  );

  // ── POST /v1/projects/:projectId/repayments ───────────────────────────
  openapi.registerPath({
    method: 'post',
    path: '/v1/projects/{projectId}/repayments',
    summary: 'Record a bundled multi-program repayment',
    description:
      'Called after the borrower signed ONE transaction containing N `repay_loan` instructions. The deployer transfers each deployed program authority back to the borrower, one program at a time and independently. loanIds are read from the stored project.',
    tags: ['projects'],
    security: [{ solignitionAuth: [] }],
    request: {
      params: ProjectIdParam,
      body: { content: { 'application/json': { schema: CreateProjectRepaymentBody } } },
    },
    responses: {
      201: {
        description: 'Repayment recorded; per-program authority transfers scheduled',
        content: { 'application/json': { schema: ProjectRepaymentResponse } },
      },
    },
  });
  app.post(
    '/v1/projects/:projectId/repayments',
    deps.rateLimit.notifyIp,
    deps.authMw('POST /v1/projects/:projectId/repayments'),
    deps.rateLimit.notifyPubkey,
    route(
      {
        params: ProjectIdParam,
        body: CreateProjectRepaymentBody,
        response: ProjectRepaymentResponse,
        status: 201,
      },
      async ({ params, body, req }) => {
        const { projectId } = params;
        const { borrower, signature } = body;
        assertAuthMatches(req, borrower, 'POST /v1/projects/:projectId/repayments', deps.logger);

        const project = await deps.stateManager.getProject(projectId);
        if (!project) throw httpError.notFound('Project not found', 'project_not_found');
        if (project.borrower !== borrower) {
          throw httpError.forbidden(
            'borrower does not match the project owner',
            'authz_mismatch',
          );
        }

        deps.logger.info('projects.repay.received', {
          projectId,
          borrower,
          signature,
          programCount: project.programs.length,
          reqId: req.id,
        });

        // Fan out one authority transfer per program, each independently
        // scheduled + try/caught (the 20s delay + pattern from loans.ts).
        const borrowerPubkey = new PublicKey(borrower);
        for (const ref of project.programs) {
          setTimeout(async () => {
            try {
              const orchestrator = deps.orchestrator();
              if (!orchestrator) {
                deps.logger.error('projects.repay.no_orchestrator', {
                  projectId,
                  loanId: ref.loanId,
                  borrower,
                });
                return;
              }
              const tx = await orchestrator.transferDeployedProgramAuth(ref.loanId, borrowerPubkey);
              deps.logger.info('projects.repay.transfer_complete', {
                projectId,
                loanId: ref.loanId,
                borrower,
                tx,
              });
            } catch (err) {
              deps.logger.error('projects.repay.transfer_failed', {
                projectId,
                loanId: ref.loanId,
                borrower,
                errorMessage: err instanceof Error ? err.message : String(err),
                errorStack: err instanceof Error ? err.stack : undefined,
              });
            }
          }, 20_000);
        }

        return {
          success: true as const,
          message: 'Repayment received; authority transfers scheduled',
          projectId,
          programs: project.programs.map((ref) => ({ loanId: ref.loanId, auth: borrower })),
        };
      },
    ),
  );
}
