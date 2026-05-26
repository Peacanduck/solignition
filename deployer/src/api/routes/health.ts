/**
 * Unversioned ops endpoints.
 *
 *   GET /health   — liveness probe. Returns {status:'ok'} only; counts
 *                   that used to live here are now exposed via /metrics so
 *                   unauthenticated callers can't enumerate them.
 *   GET /metrics  — Prometheus scrape endpoint.
 */
import type { Application } from 'express';
import type { Registry } from 'prom-client';

import { HealthResponse } from '../schemas';
import { route } from '../route-wrapper';
import { registry as openapi } from '../openapi';

export function registerHealthRoutes(
  app: Application,
  promRegistry: Registry,
): void {
  openapi.registerPath({
    method: 'get',
    path: '/health',
    summary: 'Liveness probe',
    tags: ['ops'],
    responses: {
      200: {
        description: 'Service is up',
        content: { 'application/json': { schema: HealthResponse } },
      },
    },
  });
  app.get(
    '/health',
    route({ response: HealthResponse }, () => ({ status: 'ok' as const })),
  );

  openapi.registerPath({
    method: 'get',
    path: '/metrics',
    summary: 'Prometheus metrics',
    tags: ['ops'],
    responses: { 200: { description: 'Prometheus text format' } },
  });
  app.get('/metrics', async (_req, res, next) => {
    try {
      res.set('Content-Type', promRegistry.contentType);
      res.end(await promRegistry.metrics());
    } catch (err) {
      next(err);
    }
  });
}
