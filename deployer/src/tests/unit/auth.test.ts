import { test } from 'node:test';
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createHash } from 'crypto';

import { verifyAuth } from '../../auth';

// These literals ARE the cross-repo contract (deployer auth.ts, frontend
// fetch-signed.ts, CLI client.rs must all agree byte-for-byte). Pinning them
// here means an accidental change to the canonical message format fails CI.
const VERSION_TAG = 'solignition-auth-v1';
const EMPTY_BODY_HASH = createHash('sha256').update(Buffer.alloc(0)).digest('hex');

const kp = nacl.sign.keyPair();
const pubkeyB58 = bs58.encode(kp.publicKey);

const freshNonce = () => bs58.encode(nacl.randomBytes(16));

/** Build a mock Express request carrying valid (or deliberately mismatched) auth headers. */
function buildReq(opts: {
  method?: string;
  path?: string;
  timestamp?: string;
  nonce?: string;
  /** Sign over a DIFFERENT message than the one presented, to force a tamper. */
  signOver?: { method: string; path: string; timestamp: string; nonce: string };
}) {
  const method = opts.method ?? 'GET';
  const path = opts.path ?? '/v1/projects?borrower=x';
  const timestamp = opts.timestamp ?? Date.now().toString();
  const nonce = opts.nonce ?? freshNonce();

  const signed = opts.signOver ?? { method, path, timestamp, nonce };
  const canonical = [
    VERSION_TAG,
    signed.method.toUpperCase(),
    signed.path,
    signed.timestamp,
    signed.nonce,
    EMPTY_BODY_HASH,
  ].join('\n');
  const sigB58 = bs58.encode(nacl.sign.detached(Buffer.from(canonical, 'utf8'), kp.secretKey));

  const headers: Record<string, string> = {
    'x-auth-pubkey': pubkeyB58,
    'x-auth-timestamp': timestamp,
    'x-auth-nonce': nonce,
    'x-auth-signature': sigB58,
  };
  return {
    method,
    url: path,
    originalUrl: path,
    headers: {},
    rawBody: undefined,
    header: (name: string) => headers[name.toLowerCase()],
  } as any;
}

test('a correctly signed request verifies', () => {
  const res = verifyAuth(buildReq({}));
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.pubkey, pubkeyB58);
});

test('missing X-Auth headers → missing_auth', () => {
  const res = verifyAuth({
    method: 'GET',
    url: '/x',
    originalUrl: '/x',
    headers: {},
    header: () => undefined,
  } as any);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, 'missing_auth');
});

test('tampering with the path after signing → invalid_signature', () => {
  const timestamp = Date.now().toString();
  const nonce = freshNonce();
  const req = buildReq({
    path: '/v1/projects?borrower=EVIL',
    timestamp,
    nonce,
    signOver: { method: 'GET', path: '/v1/projects?borrower=GOOD', timestamp, nonce },
  });
  const res = verifyAuth(req);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, 'invalid_signature');
});

test('a stale timestamp → timestamp_skew', () => {
  const res = verifyAuth(buildReq({ timestamp: (Date.now() - 10 * 60 * 1000).toString() }));
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, 'timestamp_skew');
});

test('reusing a nonce → replay', () => {
  const nonce = freshNonce();
  const first = verifyAuth(buildReq({ nonce }));
  assert.equal(first.ok, true);
  // same nonce, fresh timestamp + signature
  const second = verifyAuth(buildReq({ nonce }));
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.code, 'replay');
});
