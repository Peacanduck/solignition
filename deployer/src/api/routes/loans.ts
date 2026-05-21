/**
 * Loan lifecycle resource (v1).
 *
 *   POST /v1/loans                            — record a new loan-request event
 *   POST /v1/loans/:loanId/repayments         — record a repayment event
 *
 * GET /v1/loans/:loanId/status is registered separately so its commit
 * (Step 2.3 — adds the endpoint the frontend's step-status.tsx was already
 * calling against a 404) stays focused.
 */
import type { Application } from 'express';
import { PublicKey } from '@solana/web3.js';

import { httpError } from '../error-handler';
import {
  CreateLoanBody,
  CreateLoanResponse,
  CreateRepaymentBody,
  CreateRepaymentResponse,
  LoanIdParam,
} from '../schemas';
import { route } from '../route-wrapper';
import { registry as openapi } from '../openapi';
import type { RouteDeps } from './types';

/**
 * Authz check that runs regardless of authMode: as long as a pubkey was
 * presented and verified by the auth middleware, the body's `borrower`
 * must match it. This is the IDOR fix referenced in Step 3.1 -- it lives
 * inline here rather than waiting on a later commit because the new
 * handlers should not ship with the old bug.
 */
function assertAuthMatchesBorrower(
  req: import('express').Request,
  borrower: string,
  endpoint: string,
  logger: RouteDeps['logger'],
): void {
  if (req.authPubkey && req.authPubkey !== borrower) {
    logger.warn('authz_mismatch', {
      endpoint,
      authPubkey: req.authPubkey,
      borrower,
      reqId: req.id,
    });
    throw httpError.forbidden(
      'Authenticated pubkey does not match `borrower` field',
      'authz_mismatch',
    );
  }
}

export function registerLoanRoutes(app: Application, deps: RouteDeps): void {
  // ── POST /v1/loans ────────────────────────────────────────────────────
  openapi.registerPath({
    method: 'post',
    path: '/v1/loans',
    summary: 'Record a new loan-request event',
    description:
      'Called by the borrower after they signed a `request_loan` transaction on-chain. The deployer verifies the signature on-chain in the background, then kicks off deployment.',
    tags: ['loans'],
    security: [{ solignitionAuth: [] }],
    request: { body: { content: { 'application/json': { schema: CreateLoanBody } } } },
    responses: {
      201: {
        description: 'Loan event recorded; deployment will begin asynchronously',
        content: { 'application/json': { schema: CreateLoanResponse } },
      },
    },
  });
  app.post(
    '/v1/loans',
    deps.rateLimit.notifyIp,
    deps.authMw('POST /v1/loans'),
    deps.rateLimit.notifyPubkey,
    route(
      { body: CreateLoanBody, response: CreateLoanResponse, status: 201 },
      async ({ body, req }) => {
        const { signature, borrower, loanId, fileId } = body;
        assertAuthMatchesBorrower(req, borrower, 'POST /v1/loans', deps.logger);

        const fileUpload = await deps.stateManager.getFileUpload(fileId);
        if (!fileUpload) {
          deps.logger.error('loans.create.upload_missing', { borrower, fileId, reqId: req.id });
          throw httpError.notFound(
            'No file upload found for this fileId. Upload first.',
            'upload_not_found',
          );
        }
        if (fileUpload.borrower !== borrower) {
          throw httpError.forbidden(
            'fileId belongs to a different borrower',
            'upload_borrower_mismatch',
          );
        }

        deps.logger.info('loans.create.received', {
          signature,
          borrower,
          loanId,
          reqId: req.id,
        });

        // Process the loan asynchronously -- give the on-chain tx a moment
        // to be confirmed before we go look for it.
        setTimeout(() => {
          deps.processLoanFromSignature(signature, borrower, fileUpload, loanId).catch((err) =>
            deps.logger.error('loans.create.process_failed', { signature, borrower, err }),
          );
        }, 2000);

        return {
          success: true as const,
          message: 'Loan notification received. Deployment will begin shortly.',
          signature,
          fileId: fileUpload.fileId,
        };
      },
    ),
  );

  // ── POST /v1/loans/:loanId/repayments ─────────────────────────────────
  openapi.registerPath({
    method: 'post',
    path: '/v1/loans/{loanId}/repayments',
    summary: 'Record a loan-repayment event',
    description:
      'Called by the borrower after they signed `repay_loan`. The deployer transfers the deployed program authority back to the borrower.',
    tags: ['loans'],
    security: [{ solignitionAuth: [] }],
    request: {
      params: LoanIdParam,
      body: { content: { 'application/json': { schema: CreateRepaymentBody } } },
    },
    responses: {
      201: {
        description: 'Repayment recorded; authority transfer scheduled',
        content: { 'application/json': { schema: CreateRepaymentResponse } },
      },
    },
  });
  app.post(
    '/v1/loans/:loanId/repayments',
    deps.rateLimit.notifyIp,
    deps.authMw('POST /v1/loans/:loanId/repayments'),
    deps.rateLimit.notifyPubkey,
    route(
      {
        params: LoanIdParam,
        body: CreateRepaymentBody,
        response: CreateRepaymentResponse,
        status: 201,
      },
      async ({ params, body, req, res }) => {
        const { loanId } = params;
        const { borrower, signature } = body;
        assertAuthMatchesBorrower(
          req,
          borrower,
          'POST /v1/loans/:loanId/repayments',
          deps.logger,
        );

        deps.logger.info('loans.repay.received', {
          signature,
          borrower,
          loanId,
          reqId: req.id,
        });

        // The authority transfer takes time to confirm on-chain, so we
        // schedule it after the response. The original code waited 20s
        // for confirmation before responding; matching that behavior here
        // would block the client for 20s -- instead we return 201 right
        // away and the transfer happens in the background.
        setTimeout(async () => {
          try {
            const orchestrator = deps.orchestrator();
            if (!orchestrator) {
              deps.logger.error('loans.repay.no_orchestrator', { loanId, borrower });
              return;
            }
            const borrowerPubkey = new PublicKey(borrower);
            const tx = await orchestrator.transferDeployedProgramAuth(loanId, borrowerPubkey);
            deps.logger.info('loans.repay.transfer_complete', { loanId, borrower, tx });
          } catch (err) {
            deps.logger.error('loans.repay.transfer_failed', {
              loanId,
              borrower,
              errorMessage: err instanceof Error ? err.message : String(err),
              errorStack: err instanceof Error ? err.stack : undefined,
            });
          }
        }, 20_000);

        // Avoid lint warnings on unused res in the typed handler signature.
        void res;

        return {
          success: true as const,
          message: 'Repayment received; authority transfer scheduled',
          loanId,
          auth: borrower,
        };
      },
    ),
  );
}
