/**
 * Build the OpenAPI 3.1 spec from the shared zod registry and mount it.
 *
 *   GET /openapi.json   — raw spec, browseable and pipeable to code generators
 *   GET /docs           — Swagger UI rendered from the spec
 *
 * Both are unversioned: monitoring/tooling expects stable URLs for these.
 *
 * Route files register their operations against `registry` (re-exported here
 * from ./schemas.ts) at module-import time, so by the time mountOpenApi runs
 * the registry is fully populated.
 */
import type { Application } from 'express';
import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import swaggerUi from 'swagger-ui-express';

import { registry } from './schemas';

export { registry } from './schemas';

export interface OpenApiOptions {
  title?: string;
  version?: string;
  description?: string;
  /** Absolute URL clients should treat as the API origin. Set in prod. */
  serverUrl?: string;
}

export function buildOpenApiSpec(opts: OpenApiOptions = {}) {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: opts.title ?? 'Solignition Deployer API',
      version: opts.version ?? '1.0.0',
      description:
        opts.description ??
        'Off-chain deployer service for the Solignition Solana lending protocol. Authenticated with the solignition-auth-v1 wallet-signature scheme — see deployer/src/auth.ts.',
    },
    servers: opts.serverUrl ? [{ url: opts.serverUrl }] : [{ url: '/' }],
  });
}

export function mountOpenApi(app: Application, opts: OpenApiOptions = {}) {
  // Generated lazily on first request so route modules have time to register.
  // Cached after the first build — the spec doesn't change between requests.
  let cached: ReturnType<typeof buildOpenApiSpec> | null = null;
  const getSpec = () => (cached ??= buildOpenApiSpec(opts));

  app.get('/openapi.json', (_req, res) => {
    res.json(getSpec());
  });

  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: { url: '/openapi.json' },
      customSiteTitle: 'Solignition Deployer API',
    }),
  );
}
