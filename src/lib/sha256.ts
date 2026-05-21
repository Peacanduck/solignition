/**
 * SHA-256 helper backed by SubtleCrypto. Returns lowercase hex.
 *
 * Used to compute `expectedHash` for the /v1/uploads endpoint so the
 * deployer can reject corrupt transfers and wrong-file mix-ups with 422.
 */
export async function sha256Hex(data: Uint8Array | ArrayBuffer): Promise<string> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  const bytes = new Uint8Array(digest)
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}
