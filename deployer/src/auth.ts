/**
 * Wallet-signature auth middleware (`solignition-auth-v1`).
 *
 * Verifies an ed25519 signature attached to each request via four headers:
 *   - X-Auth-Pubkey      base58 Solana pubkey of the signer
 *   - X-Auth-Timestamp   Unix milliseconds (decimal string)
 *   - X-Auth-Nonce       base58 of 16 random bytes
 *   - X-Auth-Signature   base58 of the ed25519 signature
 *
 * The signed message is the canonical 6-line form
 *     solignition-auth-v1
 *     <METHOD>
 *     <PATH_INCLUDING_QUERY>
 *     <TIMESTAMP_MS>
 *     <NONCE_BASE58>
 *     <BODY_HASH_HEX>
 *
 * Body hash semantics:
 *   - GET / no body  →  sha256("")  (the EMPTY_BODY_HASH constant)
 *   - JSON           →  sha256(raw_body_bytes)   ← raw bytes off the wire
 *   - multipart      →  sha256(file_bytes)       ← multer's file.buffer
 *
 * This must stay bit-identical with the CLI (`src/client.rs::sign_request`)
 * and the frontend (`src/lib/fetch-signed.ts`). Changes here MUST land in
 * all three repos in lockstep.
 */
import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { LRUCache } from 'lru-cache';
import winston from 'winston';

const VERSION_TAG = 'solignition-auth-v1';

/** SHA-256 of the empty string, in lowercase hex. */
const EMPTY_BODY_HASH =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/** Reject requests with a timestamp more than 5 minutes off. */
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

/** Nonce cache: 10 minute TTL, 10k entries. */
const nonceCache = new LRUCache<string, true>({
  max: 10_000,
  ttl: 10 * 60 * 1000,
});

export type AuthMode = 'enforce' | 'warn' | 'off';

export function parseAuthMode(raw: string | undefined): AuthMode {
  const value = (raw ?? '').toLowerCase();
  if (value === 'true' || value === '1' || value === 'enforce') return 'enforce';
  if (value === 'warn') return 'warn';
  return 'off';
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Pubkey of the signer, set by the auth middleware on success. */
    authPubkey?: string;
    /** Raw request body bytes (set by `captureRawBody` for JSON routes). */
    rawBody?: Buffer;
    /** Per-request UUID for log correlation. */
    id?: string;
  }
}

export type AuthFailureCode =
  | 'missing_auth'
  | 'timestamp_skew'
  | 'replay'
  | 'invalid_signature'
  | 'unsupported_pubkey'
  | 'malformed_header';

export interface AuthFailure {
  code: AuthFailureCode;
  error: string;
}

type VerifyResult =
  | { ok: true; pubkey: string }
  | { ok: false; code: AuthFailureCode; error: string };

/**
 * Capture the raw JSON body so we can hash exactly the bytes the client wrote.
 * Mount this BEFORE `express.json()` on auth-required JSON routes.
 *
 * Skips multipart requests (those are handled by multer with memoryStorage and
 * the file bytes are hashed instead).
 */
export function captureRawBody(limitBytes: number) {
  return function rawBodyCapture(req: Request, res: Response, next: NextFunction) {
    const ct = (req.headers['content-type'] || '').toLowerCase();
    // For multipart/form-data, multer reads the body; do not interfere here.
    if (ct.startsWith('multipart/form-data')) {
      return next();
    }
    // Only capture for content types we'll hash (JSON + DELETE-with-body).
    if (!ct.startsWith('application/json') && req.method !== 'DELETE') {
      return next();
    }

    let total = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > limitBytes) {
        // Detach and 413 — auth can't validate a body we refused to read.
        req.removeAllListeners('data');
        req.removeAllListeners('end');
        res.status(413).json({ error: 'Request body too large', code: 'body_too_large' });
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (res.headersSent) return;
      req.rawBody = Buffer.concat(chunks);
      // Re-parse JSON for handlers (express.json normally does this, but we
      // consumed the stream first).
      if (ct.startsWith('application/json') && req.rawBody.length > 0) {
        try {
          req.body = JSON.parse(req.rawBody.toString('utf8'));
        } catch {
          return res
            .status(400)
            .json({ error: 'Invalid JSON body', code: 'malformed_json' });
        }
      }
      next();
    });
    req.on('error', (err) => next(err));
  };
}

/**
 * Build the canonical message and verify the ed25519 signature against the
 * declared pubkey. Returns `{ ok: true }` or a failure object — does not
 * send a response itself, so callers can react to `warn` vs `enforce`.
 */
export function verifyAuth(req: Request): VerifyResult {
  const pubkeyB58 = req.header('X-Auth-Pubkey');
  const tsHeader = req.header('X-Auth-Timestamp');
  const nonceB58 = req.header('X-Auth-Nonce');
  const sigB58 = req.header('X-Auth-Signature');

  if (!pubkeyB58 || !tsHeader || !nonceB58 || !sigB58) {
    return { ok: false, code: 'missing_auth', error: 'Required X-Auth-* headers missing' };
  }

  const ts = Number(tsHeader);
  if (!Number.isFinite(ts) || ts <= 0) {
    return { ok: false, code: 'malformed_header', error: 'X-Auth-Timestamp must be a positive integer (ms)' };
  }
  const skew = Math.abs(Date.now() - ts);
  if (skew > MAX_TIMESTAMP_SKEW_MS) {
    return {
      ok: false,
      code: 'timestamp_skew',
      error: `Request timestamp is off by ${Math.round(skew / 1000)}s (max ${MAX_TIMESTAMP_SKEW_MS / 1000}s)`,
    };
  }

  const nonceKey = `${pubkeyB58}:${nonceB58}`;
  if (nonceCache.has(nonceKey)) {
    return { ok: false, code: 'replay', error: 'Nonce already used recently' };
  }

  // Resolve the body hash from raw body / multer's file buffer / empty.
  const bodyHash = computeBodyHash(req);

  // Reconstruct the URL path-and-query the client signed. `req.originalUrl`
  // preserves the literal path-and-query the client sent (including any
  // sub-app mount prefix, which we don't use), so it's the right value to
  // hash. Avoid `req.url` because mounted middleware may rewrite it.
  const path = req.originalUrl || req.url;

  const canonical = [
    VERSION_TAG,
    req.method.toUpperCase(),
    path,
    tsHeader, // hash the raw header value, not Number()→toString to avoid drift
    nonceB58,
    bodyHash,
  ].join('\n');

  let pubkeyBytes: Uint8Array;
  try {
    pubkeyBytes = bs58.decode(pubkeyB58);
  } catch {
    return { ok: false, code: 'unsupported_pubkey', error: 'Pubkey is not valid base58' };
  }
  if (pubkeyBytes.length !== 32) {
    return { ok: false, code: 'unsupported_pubkey', error: 'Pubkey must be 32 bytes' };
  }

  let sigBytes: Uint8Array;
  try {
    sigBytes = bs58.decode(sigB58);
  } catch {
    return { ok: false, code: 'malformed_header', error: 'Signature is not valid base58' };
  }
  if (sigBytes.length !== 64) {
    return { ok: false, code: 'malformed_header', error: 'Signature must be 64 bytes' };
  }

  const messageBytes = Buffer.from(canonical, 'utf8');
  const valid = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes);
  if (!valid) {
    return { ok: false, code: 'invalid_signature', error: 'Signature failed verification' };
  }

  nonceCache.set(nonceKey, true);
  return { ok: true, pubkey: pubkeyB58 };
}

function computeBodyHash(req: Request): string {
  const ct = (req.headers['content-type'] || '').toLowerCase();

  // Multipart: hash the file bytes (multer's memoryStorage put them on req.file.buffer).
  if (ct.startsWith('multipart/form-data')) {
    const file = (req as Request & { file?: { buffer?: Buffer } }).file;
    if (file?.buffer) {
      return sha256Hex(file.buffer);
    }
    // Multipart with no file (or no `file` field) — hash the empty string.
    return EMPTY_BODY_HASH;
  }

  if (req.rawBody && req.rawBody.length > 0) {
    return sha256Hex(req.rawBody);
  }
  return EMPTY_BODY_HASH;
}

function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Express middleware factory. Pass `mode` to control enforcement:
 *  - `enforce`: failures → 401, request is rejected.
 *  - `warn`: failures are logged but `next()` is still called (rollout mode).
 *  - `off`: no-op (don't mount this middleware in `off` mode).
 *
 * `onFailure` is invoked once per rejected (or would-be-rejected) request so
 * the caller can bump a Prometheus counter without auth.ts depending on the
 * deployer's metrics module.
 */
export function requireAuth(
  mode: AuthMode,
  logger: winston.Logger,
  onFailure?: (code: AuthFailureCode) => void,
) {
  return function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const result = verifyAuth(req);

    if (result.ok === true) {
      req.authPubkey = result.pubkey;
      return next();
    }

    // Narrow to the failure branch via explicit extract (TS in non-strict
    // mode doesn't always pick this up from `if (result.ok) ...`).
    const failure = result as Extract<VerifyResult, { ok: false }>;
    onFailure?.(failure.code);

    const reasonLog = {
      event: 'auth_failure',
      code: failure.code,
      ip: req.ip,
      method: req.method,
      endpoint: req.originalUrl || req.url,
      pubkey: req.header('X-Auth-Pubkey'),
      reason: failure.error,
      reqId: req.id,
    };

    if (mode === 'warn') {
      logger.warn('auth.warn (would have rejected)', reasonLog);
      // Permit the request through in warn mode — this is the rollout phase.
      return next();
    }

    logger.warn('auth.reject', reasonLog);
    return res.status(401).json({ error: failure.error, code: failure.code });
  };
}
