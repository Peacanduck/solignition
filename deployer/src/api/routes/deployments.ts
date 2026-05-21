/**
 * Deployments resource (v1).
 *
 *   GET /v1/deployments/:loanId               — read
 *   GET /v1/deployments?borrower=…&…          — list (paginated)
 *
 * The old per-borrower path is now a query filter on the collection.
 */
import type { Application, Request } from 'express';

import { httpError } from '../error-handler';
import {
  DeploymentListQuery,
  DeploymentRecord as DeploymentRecordSchema,
  LoanIdParam,
  PaginatedDeployments,
} from '../schemas';
import { route } from '../route-wrapper';
import { registry as openapi } from '../openapi';
import type { RouteDeps } from './types';

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

export function registerDeploymentRoutes(app: Application, deps: RouteDeps): void {
  // ── GET /v1/deployments/:loanId ───────────────────────────────────────
  openapi.registerPath({
    method: 'get',
    path: '/v1/deployments/{loanId}',
    summary: 'Get a deployment by loanId',
    tags: ['deployments'],
    security: [{ solignitionAuth: [] }],
    request: { params: LoanIdParam },
    responses: {
      200: {
        description: 'Deployment record',
        content: { 'application/json': { schema: DeploymentRecordSchema } },
      },
    },
  });
  app.get(
    '/v1/deployments/:loanId',
    deps.rateLimit.getIp,
    deps.authMw('GET /v1/deployments/:loanId'),
    deps.rateLimit.getPubkey,
    route(
      { params: LoanIdParam, response: DeploymentRecordSchema },
      async ({ params, req }) => {
        const deployment = await deps.stateManager.getDeployment(params.loanId);
        if (!deployment) throw httpError.notFound('Deployment not found', 'deployment_not_found');
        assertAuthMatches(req, deployment.borrower, 'GET /v1/deployments/:loanId', deps.logger);
        return deployment;
      },
    ),
  );

  // ── GET /v1/deployments?borrower=…&limit=…&offset=… ───────────────────
  openapi.registerPath({
    method: 'get',
    path: '/v1/deployments',
    summary: 'List deployments (paginated)',
    description:
      'Filter by borrower. Default limit 50, max 200. Authenticated callers may only list their own deployments.',
    tags: ['deployments'],
    security: [{ solignitionAuth: [] }],
    request: { query: DeploymentListQuery },
    responses: {
      200: {
        description: 'Page of deployments',
        content: { 'application/json': { schema: PaginatedDeployments } },
      },
    },
  });
  app.get(
    '/v1/deployments',
    deps.rateLimit.getIp,
    deps.authMw('GET /v1/deployments'),
    deps.rateLimit.getPubkey,
    route(
      { query: DeploymentListQuery, response: PaginatedDeployments },
      async ({ query, req }) => {
        const { limit, offset, borrower } = query;
        if (req.authPubkey) {
          if (!borrower) {
            throw httpError.badRequest(
              'borrower query parameter is required',
              'borrower_required',
            );
          }
          if (borrower !== req.authPubkey) {
            throw httpError.forbidden(
              'borrower does not match authenticated pubkey',
              'authz_mismatch',
            );
          }
        }

        // Storage-layer pagination (Step 3.3).
        const page = await deps.stateManager.getDeploymentsPage({
          borrower,
          limit,
          offset,
        });
        return {
          deployments: page.deployments,
          total: page.total,
          limit,
          offset,
          hasMore: page.hasMore,
        };
      },
    ),
  );
}
