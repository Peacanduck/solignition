/**
 * Shared HTTP middleware factories: rate limiters and the auth wrapper.
 *
 * Two rate-limit layers run concurrently on authed routes — a request is
 * blocked if either trips. Per-IP is the DoS defence; per-pubkey is the
 * abuse defence (a single legit IP behind NAT can have many wallets).
 */
import type { Request, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import { type AuthMode, requireAuth } from '../auth';

export const ipKey = (req: Request) => req.ip || 'unknown';
export const pubkeyKey = (req: Request) =>
  req.authPubkey || `ip:${req.ip || 'unknown'}`;

const rateLimitMessage = (code: string, label: string) => ({
  error: `Rate limit exceeded (${label})`,
  code,
});

export interface RateLimiters {
  uploadIp: RequestHandler;
  uploadPubkey: RequestHandler;
  uploadPubkeyDaily: RequestHandler;
  notifyIp: RequestHandler;
  notifyPubkey: RequestHandler;
  getIp: RequestHandler;
  getPubkey: RequestHandler;
}

export function buildRateLimiters(): RateLimiters {
  return {
    uploadIp: rateLimit({
      windowMs: 60 * 60 * 1000, // 1h
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: ipKey,
      message: rateLimitMessage('rate_limit_ip', 'POST /v1/uploads per IP'),
    }),
    uploadPubkey: rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 15,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: pubkeyKey,
      message: rateLimitMessage('rate_limit_pubkey', 'POST /v1/uploads per pubkey (hour)'),
    }),
    uploadPubkeyDaily: rateLimit({
      windowMs: 24 * 60 * 60 * 1000,
      max: 50,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: pubkeyKey,
      message: rateLimitMessage('rate_limit_pubkey_daily', 'POST /v1/uploads per pubkey (day)'),
    }),
    notifyIp: rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: ipKey,
      message: rateLimitMessage('rate_limit_ip', 'loan-event POST per IP'),
    }),
    notifyPubkey: rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: pubkeyKey,
      message: rateLimitMessage('rate_limit_pubkey', 'loan-event POST per pubkey'),
    }),
    getIp: rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: ipKey,
      message: rateLimitMessage('rate_limit_ip', 'GET per IP'),
    }),
    getPubkey: rateLimit({
      windowMs: 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: pubkeyKey,
      message: rateLimitMessage('rate_limit_pubkey', 'GET per pubkey'),
    }),
  };
}

/**
 * Auth middleware factory. The endpoint label is included in the failure
 * metric so per-route attack patterns are visible in Prometheus
 * (deployer_http_auth_failures_total{code,endpoint}).
 */
export function buildAuthMw(
  authMode: AuthMode,
  logger: winston.Logger,
  onFailure: (code: string, endpoint: string) => void,
) {
  return (endpoint: string) =>
    requireAuth(authMode, logger, (code) => onFailure(code, endpoint));
}
