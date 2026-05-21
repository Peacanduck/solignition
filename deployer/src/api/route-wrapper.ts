/**
 * Typed route wrapper that validates `req.params`, `req.query`, and `req.body`
 * against zod schemas before invoking the handler. Anything that throws or
 * rejects forwards to the global error handler (see ./error-handler.ts), so
 * handlers never need try/catch boilerplate.
 *
 * Wire each route as:
 *   app.get('/v1/uploads/:fileId',
 *     ...middleware,
 *     route({ params: FileIdParam, response: FileUploadRecord }, async ({ params }) => {
 *       const upload = await stateManager.getFileUpload(params.fileId);
 *       if (!upload) throw httpError.notFound('Upload not found');
 *       return upload;
 *     }),
 *   );
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z, ZodSchema } from 'zod';

export interface RouteSchemas<
  TParams extends ZodSchema = ZodSchema,
  TQuery extends ZodSchema = ZodSchema,
  TBody extends ZodSchema = ZodSchema,
  TResponse extends ZodSchema = ZodSchema,
> {
  params?: TParams;
  query?: TQuery;
  body?: TBody;
  /** Used only for OpenAPI generation; the handler's return value isn't re-validated at runtime. */
  response?: TResponse;
  /** HTTP status code on success. Default 200; use 201 for creates, 202 for accepted-jobs, 204 for delete. */
  status?: number;
  /** OpenAPI metadata. */
  summary?: string;
  description?: string;
  tags?: string[];
}

export interface TypedHandlerArgs<
  TParams extends ZodSchema,
  TQuery extends ZodSchema,
  TBody extends ZodSchema,
> {
  params: z.infer<TParams>;
  query: z.infer<TQuery>;
  body: z.infer<TBody>;
  req: Request;
  res: Response;
}

export type TypedHandler<
  TParams extends ZodSchema,
  TQuery extends ZodSchema,
  TBody extends ZodSchema,
  TResponse extends ZodSchema,
> = (args: TypedHandlerArgs<TParams, TQuery, TBody>) => Promise<z.infer<TResponse> | void> | z.infer<TResponse> | void;

/**
 * Build an express RequestHandler that:
 *   1. parses `params`/`query`/`body` through the supplied schemas (throws ZodError on failure)
 *   2. awaits the handler
 *   3. if the handler returned a value AND the response hasn't been sent, JSON-responds with `status`
 *   4. forwards any throw / rejection to `next(err)` for the global error handler
 *
 * A handler that wants full control (streaming, redirect, custom headers) can
 * just call `res.send(...)` itself and return `undefined`.
 */
export function route<
  TParams extends ZodSchema,
  TQuery extends ZodSchema,
  TBody extends ZodSchema,
  TResponse extends ZodSchema,
>(
  schemas: RouteSchemas<TParams, TQuery, TBody, TResponse>,
  handler: TypedHandler<TParams, TQuery, TBody, TResponse>,
): RequestHandler {
  const successStatus = schemas.status ?? 200;
  return async (req, res, next) => {
    try {
      const params = (schemas.params ? schemas.params.parse(req.params) : req.params) as z.infer<TParams>;
      const query = (schemas.query ? schemas.query.parse(req.query) : req.query) as z.infer<TQuery>;
      const body = (schemas.body ? schemas.body.parse(req.body) : req.body) as z.infer<TBody>;

      const result = await handler({ params, query, body, req, res });

      if (res.headersSent) return;
      if (successStatus === 204) {
        res.status(204).end();
        return;
      }
      res.status(successStatus).json(result ?? { success: true });
    } catch (err) {
      next(err);
    }
  };
}
