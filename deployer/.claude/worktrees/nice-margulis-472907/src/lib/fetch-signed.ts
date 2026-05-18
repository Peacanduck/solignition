import { useCallback } from 'react'
import type { UiWalletAccount } from '@wallet-ui/react'
import { useSignMessage } from '@solana/react'
import bs58 from 'bs58'
import { toast } from 'sonner'

const VERSION_TAG = 'solignition-auth-v1'

/** SHA-256 of an empty body, lowercase hex. */
const EMPTY_BODY_HASH =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

export type FetchSignedInit = RequestInit & {
  /**
   * For `multipart/form-data` requests, pass the raw file bytes here so we can
   * hash them BEFORE the multipart envelope is constructed. Per the shared spec,
   * `BODY_HASH_HEX = sha256(file_bytes)` for multipart — the `borrower` form
   * field is enforced separately via authz, not hashed.
   */
  fileBytes?: Uint8Array
}

type SignMessageFn = (input: { message: Uint8Array }) => Promise<{
  signature: Uint8Array
  signedMessage: Uint8Array
}>

/**
 * React hook that returns a bound `fetchSigned` function for the given
 * connected wallet account. Each call signs an ed25519 message per the
 * shared `solignition-auth-v1` spec (see `auth.ts` on the deployer and
 * `src/client.rs` in the CLI repo — they must stay in lockstep).
 *
 * Callers must only mount this hook when a wallet is connected. The
 * borrow/dashboard tabs already gate on `account != null`; query hooks
 * (`useUploadedPrograms`, etc.) take `account` as a required param for the
 * same reason.
 */
export function useFetchSigned(account: UiWalletAccount) {
  const signMessage = useSignMessage(account)
  const pubkey = account.address

  return useCallback(
    (url: string, init: FetchSignedInit = {}) =>
      fetchSignedInternal({ pubkey, signMessage }, url, init),
    [pubkey, signMessage],
  )
}

async function fetchSignedInternal(
  ctx: { pubkey: string; signMessage: SignMessageFn },
  url: string,
  init: FetchSignedInit,
): Promise<Response> {
  const response = await signAndFetch(ctx, url, init)

  if (response.status !== 401) {
    return response
  }

  // 401 — inspect the body so we can react to specific codes. Clone first so
  // the original body remains readable to the caller.
  let code: string | undefined
  try {
    const cloned = response.clone()
    const json = (await cloned.json()) as { code?: string; error?: string }
    code = json.code
  } catch {
    // Non-JSON body — fall through to generic handling
  }

  if (code === 'replay') {
    // Transient — retry once with a fresh nonce. If it still fails, return
    // the second response so the caller sees a real error.
    return signAndFetch(ctx, url, init)
  }

  if (code === 'timestamp_skew') {
    toast.error('Your device clock is off', {
      description: 'Please correct your system time and try again.',
    })
  } else if (code === 'missing_auth' || code === 'invalid_signature') {
    console.error('Solignition auth failure', { url, code })
    toast.error('Authentication failed', {
      description: 'Please reconnect your wallet and try again.',
    })
  }

  return response
}

async function signAndFetch(
  ctx: { pubkey: string; signMessage: SignMessageFn },
  url: string,
  init: FetchSignedInit,
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const parsedUrl = new URL(url, window.location.origin)
  const path = parsedUrl.pathname + parsedUrl.search

  const bodyHash = await computeBodyHash(method, init)

  const timestamp = Date.now().toString()
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16))
  const nonce = bs58.encode(nonceBytes)

  const canonical = [VERSION_TAG, method, path, timestamp, nonce, bodyHash].join('\n')
  const messageBytes = new TextEncoder().encode(canonical)

  const { signature } = await ctx.signMessage({ message: messageBytes })
  const sigB58 = bs58.encode(signature)

  const headers = new Headers(init.headers)
  headers.set('X-Auth-Pubkey', ctx.pubkey)
  headers.set('X-Auth-Timestamp', timestamp)
  headers.set('X-Auth-Nonce', nonce)
  headers.set('X-Auth-Signature', sigB58)

  // Strip the helper-only field before forwarding to fetch.
  const passthrough: RequestInit = { ...init, headers }
  delete (passthrough as FetchSignedInit).fileBytes
  return fetch(url, passthrough)
}

async function computeBodyHash(method: string, init: FetchSignedInit): Promise<string> {
  // Multipart: hash the file bytes ONLY (the `borrower` field is enforced
  // separately by authz on the server). Check this FIRST so a multipart upload
  // doesn't fall through to the generic-body branch.
  if (init.fileBytes) {
    return sha256Hex(init.fileBytes)
  }

  // GET/HEAD/etc. or genuinely empty body → spec constant.
  if (method === 'GET' || method === 'HEAD' || init.body === undefined || init.body === null) {
    return EMPTY_BODY_HASH
  }

  // JSON body: caller already stringified — hash those exact bytes.
  if (typeof init.body === 'string') {
    return sha256Hex(new TextEncoder().encode(init.body))
  }

  if (init.body instanceof Uint8Array) {
    return sha256Hex(init.body)
  }

  if (init.body instanceof ArrayBuffer) {
    return sha256Hex(new Uint8Array(init.body))
  }

  // FormData/Blob/ReadableStream: the browser serializes those after we'd
  // hash them, so the wire bytes wouldn't match. For multipart `/upload`,
  // callers must pass `fileBytes` explicitly.
  throw new Error(
    'fetchSigned: unsupported request body type. Pass a string, Uint8Array, ArrayBuffer, or use the `fileBytes` option for multipart uploads.',
  )
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // TS 5.7+ tightened `BufferSource` to reject `Uint8Array<ArrayBufferLike>`
  // — the cast to ArrayBuffer is safe here because crypto.subtle copies the
  // bytes internally.
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
