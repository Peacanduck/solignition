/**
 * Global error handler for the v1 REST API.
 *
 * Mounted last in the middleware chain so any thrown / next(err) lands here.
 * Maps known error types to status codes, returns a consistent envelope
 * (`{error, code, requestId}`), and logs the full stack to winston without
 * ever leaking it to the response.
 */
import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import winston from 'winston';

/** Thrown by handlers that want to short-circuit with a specific HTTP code. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Convenience constructors so handlers read top-to-bottom. */
export const httpError = {
  badRequest: (msg: string, code = 'bad_request') => new HttpError(400, msg, code),
  unauthorized: (msg: string, code = 'unauthorized') => new HttpError(401, msg, code),
  forbidden: (msg: string, code = 'forbidden') => new HttpError(403, msg, code),
  notFound: (msg: string, code = 'not_found') => new HttpError(404, msg, code),
  conflict: (msg: string, code = 'conflict') => new HttpError(409, msg, code),
  payloadTooLarge: (msg: string, code = 'too_large') => new HttpError(413, msg, code),
  unprocessable: (msg: string, code = 'unprocessable') => new HttpError(422, msg, code),
};

interface ErrorEnvelope {
  error: string;
  code: string;
  requestId?: string;
  details?: unknown;
}

export function errorHandler(logger: winston.Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    // Express forwards errors here even after the response started streaming.
    // If headers are already sent, we can only close the socket; replying again
    // would throw `ERR_HTTP_HEADERS_SENT` and mask the original failure.
    if (res.headersSent) {
      logger.error('error_after_headers', {
        reqId: req.id,
        message: err instanceof Error ? err.message : String(err),
      });
      return res.end();
    }

    const requestId = req.id;
    const envelope: ErrorEnvelope = { error: 'Internal server error', code: 'internal', requestId };
    let status = 500;

    if (err instanceof ZodError) {
      status = 422;
      envelope.error = 'Request validation failed';
      envelope.code = 'validation_failed';
      // Zod issue paths are safe to expose — they describe the request the
      // client just sent, not internal state. Strip stack/cause defensively.
      envelope.details = err.issues.map((i) => ({
        path: i.path,
        message: i.message,
        code: i.code,
      }));
    } else if (err instanceof MulterError) {
      switch (err.code) {
        case 'LIMIT_FILE_SIZE':
          status = 413;
          envelope.error = 'File exceeds the size limit';
          envelope.code = 'too_large';
          break;
        case 'LIMIT_UNEXPECTED_FILE':
          status = 400;
          envelope.error = 'Unexpected file field';
          envelope.code = 'unexpected_file';
          break;
        case 'LIMIT_FILE_COUNT':
        case 'LIMIT_FIELD_COUNT':
        case 'LIMIT_FIELD_KEY':
        case 'LIMIT_FIELD_VALUE':
        case 'LIMIT_PART_COUNT':
          status = 400;
          envelope.error = 'Multipart form exceeded a limit';
          envelope.code = 'multipart_limit';
          break;
        default:
          status = 400;
          envelope.error = 'Multipart parse error';
          envelope.code = 'multipart_error';
      }
    } else if (err instanceof HttpError) {
      status = err.status;
      envelope.error = err.message;
      envelope.code = err.code ?? envelope.code;
    } else if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
      // body-parser / express.json size limit
      status = 413;
      envelope.error = 'Request body too large';
      envelope.code = 'body_too_large';
    }

    // Always log the full stack. Never put it on the response.
    logger.error('http_error', {
      status,
      code: envelope.code,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      reqId: requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });

    res.status(status).json(envelope);
  };
}
