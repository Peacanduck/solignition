/**
 * Uploads resource (v1).
 *
 *   POST   /v1/uploads                       — create (multipart, returns 201 + Location)
 *   GET    /v1/uploads/:fileId               — read
 *   GET    /v1/uploads?borrower=…&…          — list (always paginated; no path suffix)
 *   DELETE /v1/uploads/:fileId               — delete (returns 204)
 *
 * The old per-borrower path (`/uploads/borrower/:borrower`) and the
 * `/paginated` suffix are gone — borrower is a query filter now and
 * pagination is always on with a server-cap of 200.
 */
import type { Application, Request } from 'express';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { httpError } from '../error-handler';
import {
  CreateUploadFormFields,
  CreateUploadResponse,
  FileIdParam,
  FileUploadRecord as FileUploadRecordSchema,
  PaginatedUploads,
  UploadListQuery,
} from '../schemas';
import { route } from '../route-wrapper';
import { registry as openapi } from '../openapi';
import type { FileUploadRecord, RouteDeps } from './types';

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

export function registerUploadRoutes(app: Application, deps: RouteDeps): void {
  // ── POST /v1/uploads ──────────────────────────────────────────────────
  openapi.registerPath({
    method: 'post',
    path: '/v1/uploads',
    summary: 'Upload a Solana program binary (.so)',
    description:
      'Multipart: file=<.so>, borrower=<pubkey>, optional expectedHash=<sha256 hex>. Returns 201 with the new fileId and Location header.',
    tags: ['uploads'],
    security: [{ solignitionAuth: [] }],
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: CreateUploadFormFields.extend({
              file: { type: 'string', format: 'binary' } as unknown as never,
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Upload created',
        headers: {
          Location: { schema: { type: 'string' }, description: 'URL of the new upload resource' },
        },
        content: { 'application/json': { schema: CreateUploadResponse } },
      },
    },
  });
  app.post(
    '/v1/uploads',
    deps.rateLimit.uploadIp,
    deps.multer.single('file'),
    deps.authMw('POST /v1/uploads'),
    deps.rateLimit.uploadPubkey,
    deps.rateLimit.uploadPubkeyDaily,
    route(
      {
        body: CreateUploadFormFields,
        response: CreateUploadResponse,
        status: 201,
      },
      async ({ body, req, res }) => {
        let tmpPath: string | null = null;
        try {
          if (!req.file) {
            throw httpError.badRequest('No file uploaded', 'no_file');
          }
          const { borrower, expectedHash } = body;
          assertAuthMatches(req, borrower, 'POST /v1/uploads', deps.logger);

          const safeFileName = path.basename(req.file.originalname || 'program.so');
          if (safeFileName.includes('\0') || safeFileName.includes('..')) {
            deps.metrics.validationRejected.inc({ reason: 'bad_filename' });
            throw httpError.badRequest('Invalid filename', 'bad_filename');
          }

          const buffer = req.file.buffer;

          // ELF magic check before we persist anything.
          if (
            buffer.length < 4 ||
            buffer[0] !== 0x7f ||
            buffer[1] !== 0x45 ||
            buffer[2] !== 0x4c ||
            buffer[3] !== 0x46
          ) {
            deps.metrics.validationRejected.inc({ reason: 'not_elf' });
            throw httpError.badRequest('File is not a valid ELF binary', 'not_elf');
          }

          if (buffer.length > deps.config.maxUploadBytes) {
            deps.metrics.validationRejected.inc({ reason: 'too_large' });
            throw httpError.payloadTooLarge(
              `File exceeds ${deps.config.maxUploadBytes} byte limit`,
              'too_large',
            );
          }

          const hash = createHash('sha256').update(buffer).digest('hex');

          // Step 3.4 hash-pinning: if the client supplied an expectedHash,
          // it must match what we computed. Rejects bit-corruption in
          // transit and any client-server hash drift before we charge
          // storage / rent estimation against the upload.
          if (expectedHash && expectedHash !== hash) {
            deps.metrics.validationRejected.inc({ reason: 'hash_mismatch' });
            throw httpError.unprocessable(
              'Computed sha256 does not match supplied expectedHash',
              'hash_mismatch',
            );
          }

          // Dedup: same borrower uploading bit-identical bytes returns the
          // existing fileId rather than creating a duplicate.
          const existing = await deps.stateManager.getAllFileUploadsByBorrower(borrower);
          const dupe = existing.find((u) => u.binaryHash === hash && u.status !== 'deployed');
          if (dupe) {
            deps.logger.info('uploads.dedup', { borrower, fileId: dupe.fileId, reqId: req.id });
            res.setHeader('Location', `/v1/uploads/${dupe.fileId}`);
            return {
              success: true as const,
              fileId: dupe.fileId,
              estimatedCost: dupe.estimatedCost,
              binaryHash: dupe.binaryHash,
              message: 'Matching upload already exists for this wallet.',
            };
          }

          deps.logger.info('uploads.accepted', {
            fileName: safeFileName,
            size: buffer.length,
            borrower,
            reqId: req.id,
          });

          await fs.mkdir(deps.config.uploadPath, { recursive: true });
          tmpPath = path.join(deps.config.uploadPath, `${uuidv4()}.so`);
          await fs.writeFile(tmpPath, buffer);

          const fileId = createHash('sha256')
            .update(borrower + Date.now())
            .digest('hex')
            .substring(0, 16);

          const { hash: storedHash, destinationPath } = await deps.binaryManager.storeBinary(
            fileId,
            tmpPath,
          );

          const estimatedCost = await deps.binaryManager.estimateDeploymentCost(destinationPath);

          const fileUpload: FileUploadRecord = {
            fileId,
            borrower,
            fileName: safeFileName,
            filePath: destinationPath,
            fileSize: buffer.length,
            binaryHash: storedHash,
            estimatedCost,
            status: 'ready',
            createdAt: Date.now(),
          };

          await deps.stateManager.saveFileUpload(fileUpload);
          deps.metrics.fileUploads.inc();

          res.setHeader('Location', `/v1/uploads/${fileId}`);
          return {
            success: true as const,
            fileId,
            estimatedCost,
            binaryHash: storedHash,
            message: 'File uploaded successfully. You can now request a loan for deployment.',
          };
        } finally {
          if (tmpPath) {
            await fs.unlink(tmpPath).catch(() => {});
          }
        }
      },
    ),
  );

  // ── GET /v1/uploads/:fileId ───────────────────────────────────────────
  openapi.registerPath({
    method: 'get',
    path: '/v1/uploads/{fileId}',
    summary: 'Get an upload by fileId',
    tags: ['uploads'],
    security: [{ solignitionAuth: [] }],
    request: { params: FileIdParam },
    responses: {
      200: {
        description: 'Upload record',
        content: { 'application/json': { schema: FileUploadRecordSchema } },
      },
    },
  });
  app.get(
    '/v1/uploads/:fileId',
    deps.rateLimit.getIp,
    deps.authMw('GET /v1/uploads/:fileId'),
    deps.rateLimit.getPubkey,
    route(
      { params: FileIdParam, response: FileUploadRecordSchema },
      async ({ params, req }) => {
        const upload = await deps.stateManager.getFileUpload(params.fileId);
        if (!upload) throw httpError.notFound('Upload not found', 'upload_not_found');
        assertAuthMatches(req, upload.borrower, 'GET /v1/uploads/:fileId', deps.logger);
        return upload;
      },
    ),
  );

  // ── GET /v1/uploads?borrower=…&status=…&limit=…&offset=… ──────────────
  openapi.registerPath({
    method: 'get',
    path: '/v1/uploads',
    summary: 'List uploads (paginated)',
    description:
      'Filter by borrower and/or status. Default limit 50, max 200. Authenticated callers may only list their own uploads.',
    tags: ['uploads'],
    security: [{ solignitionAuth: [] }],
    request: { query: UploadListQuery },
    responses: {
      200: {
        description: 'Page of uploads',
        content: { 'application/json': { schema: PaginatedUploads } },
      },
    },
  });
  app.get(
    '/v1/uploads',
    deps.rateLimit.getIp,
    deps.authMw('GET /v1/uploads'),
    deps.rateLimit.getPubkey,
    route(
      { query: UploadListQuery, response: PaginatedUploads },
      async ({ query, req }) => {
        const { limit, offset, borrower, status } = query;
        // Authz: a signed caller can only ever list their own uploads.
        // Unsigned callers (off-mode) can pass `borrower` freely; the off
        // mode is rejected at boot in production by Step 3.1.
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

        // Storage-layer pagination (Step 3.3): bounded scan that stops
        // after enough matches for one page, never loads the full DB.
        const page = await deps.stateManager.getFileUploadsPage({
          borrower,
          status,
          limit,
          offset,
        });
        return {
          uploads: page.uploads,
          total: page.total,
          limit,
          offset,
          hasMore: page.hasMore,
        };
      },
    ),
  );

  // ── DELETE /v1/uploads/:fileId ────────────────────────────────────────
  openapi.registerPath({
    method: 'delete',
    path: '/v1/uploads/{fileId}',
    summary: 'Delete an upload (only while not yet deployed)',
    tags: ['uploads'],
    security: [{ solignitionAuth: [] }],
    request: { params: FileIdParam },
    responses: { 204: { description: 'Deleted' } },
  });
  app.delete(
    '/v1/uploads/:fileId',
    deps.rateLimit.notifyIp,
    deps.authMw('DELETE /v1/uploads/:fileId'),
    deps.rateLimit.notifyPubkey,
    route(
      { params: FileIdParam, status: 204 },
      async ({ params, req }) => {
        const upload = await deps.stateManager.getFileUpload(params.fileId);
        if (!upload) throw httpError.notFound('Upload not found', 'upload_not_found');
        assertAuthMatches(req, upload.borrower, 'DELETE /v1/uploads/:fileId', deps.logger);
        if (upload.status === 'deployed') {
          throw httpError.conflict(
            'Cannot delete a deployed upload',
            'upload_already_deployed',
          );
        }
        try {
          await fs.unlink(upload.filePath);
        } catch (err) {
          deps.logger.warn('uploads.delete.unlink_failed', {
            filePath: upload.filePath,
            err,
          });
        }
        // NOTE: the original code left the DB record behind ("Delete from state TBI").
        // Keeping that behavior here so this commit is pure refactor; a follow-up
        // can wire StateManager.deleteFileUpload when it exists.
      },
    ),
  );
}
