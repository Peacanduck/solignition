/**
 * Standalone generator for the v1 OpenAPI spec.
 *
 * Used by:
 *   - `npm run openapi:gen`       — write deployer/openapi.json
 *   - .github/workflows/deployer-api-contract.yml — diff against committed baseline
 *
 * Does NOT boot the full app: instantiates stub deps and calls every route
 * registrar so the shared zod-to-openapi registry populates. The result is
 * functionally identical to what `GET /openapi.json` would return at
 * runtime, but doesn't need a DB, keypairs, or Solana RPC connectivity.
 */
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import multer from 'multer';
import winston from 'winston';
import { Registry } from 'prom-client';
import { Counter } from 'prom-client';

import { buildRateLimiters } from '../src/api/middleware';
import { mountOpenApi, registry as openapiRegistry } from '../src/api/openapi';
import { buildOpenApiSpec } from '../src/api/openapi';
import { registerHealthRoutes } from '../src/api/routes/health';
import { registerJobRoutes } from '../src/api/routes/jobs';
import { registerLoanRoutes } from '../src/api/routes/loans';
import { registerUploadRoutes } from '../src/api/routes/uploads';
import { registerDeploymentRoutes } from '../src/api/routes/deployments';
import type { RouteDeps } from '../src/api/routes/types';

// Silence the logger -- this script is supposed to print JSON to stdout only.
const logger = winston.createLogger({
  level: 'error',
  transports: [new winston.transports.Console({ silent: true })],
});

const promRegistry = new Registry();
const stubCounter = new Counter({
  name: 'stub_total',
  help: 'stub for openapi generation',
  labelNames: ['code', 'endpoint', 'reason'],
  registers: [promRegistry],
});

// Stub deps -- handlers will never actually run; we only need the
// register*() functions to invoke their openapi.registerPath calls.
const stubDeps: RouteDeps = {
  stateManager: {} as RouteDeps['stateManager'],
  binaryManager: {} as RouteDeps['binaryManager'],
  orchestrator: () => null,
  multer: multer({ storage: multer.memoryStorage() }),
  rateLimit: buildRateLimiters(),
  authMw: () => (_req, _res, next) => next(),
  logger,
  metrics: {
    fileUploads: stubCounter,
    validationRejected: stubCounter,
    authFailures: stubCounter,
  },
  config: { authMode: 'off', maxUploadBytes: 4 * 1024 * 1024, uploadPath: '/tmp' },
  processLoanFromSignature: async () => undefined,
};

const app = express();
mountOpenApi(app);
registerHealthRoutes(app, promRegistry);
registerJobRoutes(app, stubDeps);
registerLoanRoutes(app, stubDeps);
registerUploadRoutes(app, stubDeps);
registerDeploymentRoutes(app, stubDeps);

// Touch the registry to make sure it isn't empty (paranoia: catches the
// "registrars were no-ops" failure mode early).
if (openapiRegistry.definitions.length === 0) {
  console.error('FATAL: openapi registry is empty after registering all routes.');
  process.exit(1);
}

// Public base URL the deployer is served from in production. Hardcoded (not
// read from env) so the generated spec is deterministic and the committed
// openapi.json baseline matches byte-for-byte in CI.
const PROD_SERVER_URL = 'https://api.solignition.ngrok.app';

const spec = buildOpenApiSpec({ serverUrl: PROD_SERVER_URL });

const outArg = process.argv[2];
if (outArg === '-') {
  process.stdout.write(JSON.stringify(spec, null, 2) + '\n');
} else {
  const outPath = outArg ?? path.resolve(__dirname, '..', 'openapi.json');
  fs.writeFileSync(outPath, JSON.stringify(spec, null, 2) + '\n');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${outPath}`);
}
