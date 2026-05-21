/**
 * Operations namespace for maintenance jobs.
 *
 *   POST /v1/jobs/expired-loan-check  — kicks off the expired-loan sweep.
 *     Returns 202 Accepted immediately; the work runs in the background
 *     against the orchestrator.
 */
import type { Application } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { httpError } from '../error-handler';
import { JobAcceptedResponse } from '../schemas';
import { route } from '../route-wrapper';
import { registry as openapi } from '../openapi';
import type { RouteDeps } from './types';

export function registerJobRoutes(app: Application, deps: RouteDeps): void {
  openapi.registerPath({
    method: 'post',
    path: '/v1/jobs/expired-loan-check',
    summary: 'Trigger an expired-loan recovery sweep',
    description:
      'Kicks off the same sweep the cron job runs. Returns 202 immediately; check logs / metrics for completion.',
    tags: ['jobs'],
    security: [{ solignitionAuth: [] }],
    responses: {
      202: {
        description: 'Job accepted',
        content: { 'application/json': { schema: JobAcceptedResponse } },
      },
    },
  });
  app.post(
    '/v1/jobs/expired-loan-check',
    deps.authMw('POST /v1/jobs/expired-loan-check'),
    route(
      { response: JobAcceptedResponse, status: 202 },
      ({ req }) => {
        const orchestrator = deps.orchestrator();
        if (!orchestrator) {
          throw httpError.conflict('Orchestrator not initialized', 'orchestrator_unavailable');
        }
        const jobId = uuidv4();
        deps.logger.info('jobs.expired_loan_check.start', { jobId, reqId: req.id });
        orchestrator
          .checkExpiredLoans()
          .then(() =>
            deps.logger.info('jobs.expired_loan_check.complete', { jobId }),
          )
          .catch((err) =>
            deps.logger.error('jobs.expired_loan_check.failed', { jobId, err }),
          );
        return {
          success: true as const,
          message: 'Expired loan check initiated with full recovery flow',
          jobId,
        };
      },
    ),
  );
}
