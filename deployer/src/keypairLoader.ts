/**
 * Keypair-at-rest loader.
 *
 * Files ending in `.age` are passphrase-encrypted (via the `age-encryption`
 * package). Plain JSON files are loaded as-is but trigger an INSECURE warning
 * — that fallback exists only for local dev where mounting a passphrase isn't
 * worth the friction. Production deployments MUST supply the passphrase env
 * vars and use `.age` files.
 *
 * Threat model: encrypting the on-disk keypair protects against attackers who
 * read the deployer's filesystem (e.g. stolen backups, leaked snapshots). It
 * does NOT protect against an attacker with live process access — once the
 * key is decrypted in memory we have no defence beyond OS isolation.
 * Roadmap: migrate to Azure Key Vault when TVL justifies the cost.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { Keypair } from '@solana/web3.js';
import { Decrypter } from 'age-encryption';
import winston from 'winston';

export interface LoadKeypairOptions {
  /** Absolute or relative path to a `.json` (plaintext) or `.age` (encrypted) keypair. */
  filePath: string;
  /** Passphrase for `.age` files; ignored for plaintext. */
  passphrase?: string;
  /** Logger for the one-shot insecure-fallback warning. */
  logger: winston.Logger;
  /** Human-friendly name for the warning (e.g. "deployer", "admin"). */
  label: string;
}

export async function loadKeypair({
  filePath,
  passphrase,
  logger,
  label,
}: LoadKeypairOptions): Promise<Keypair> {
  const resolved = path.resolve(filePath);
  const ext = path.extname(resolved).toLowerCase();

  let secret: Uint8Array;

  if (ext === '.age') {
    if (!passphrase) {
      throw new Error(
        `${label} keypair at ${resolved} is encrypted (.age) but no passphrase env var is set. ` +
          `Set the corresponding *_PASSPHRASE variable or use a plaintext .json file (local dev only).`,
      );
    }
    const ciphertext = await fs.readFile(resolved);
    const decrypter = new Decrypter();
    decrypter.addPassphrase(passphrase);
    const plaintext = await decrypter.decrypt(ciphertext);
    secret = parseSolanaSecretKey(plaintext, resolved);
  } else if (ext === '.json') {
    if (!passphrase) {
      logger.warn(
        `⚠ INSECURE: ${label} keypair is being loaded from plaintext JSON (${resolved}). ` +
          `For production, encrypt it with scripts/encrypt-keypair.ts and set ${label.toUpperCase()}_KEYPAIR_PASSPHRASE.`,
      );
    } else {
      // Passphrase supplied but file is plaintext — caller probably misconfigured.
      logger.warn(
        `${label} passphrase env is set but keypair file is plaintext JSON (${resolved}). ` +
          `Ignoring passphrase. Re-encrypt the file or unset the env var to silence this warning.`,
      );
    }
    const buf = await fs.readFile(resolved, 'utf8');
    secret = parseSolanaSecretKey(buf, resolved);
  } else {
    throw new Error(
      `${label} keypair file must be .json or .age (got "${ext}" at ${resolved}).`,
    );
  }

  if (secret.length !== 64) {
    throw new Error(
      `${label} keypair has unexpected length ${secret.length}; expected 64 bytes (Solana secret key).`,
    );
  }
  return Keypair.fromSecretKey(secret);
}

function parseSolanaSecretKey(input: Uint8Array | string, where: string): Uint8Array {
  // A Solana secret key on disk is a JSON array of 64 numbers. Both .age and .json
  // paths arrive here; decrypted payloads are UTF-8 text of that same JSON.
  const text = typeof input === 'string' ? input : Buffer.from(input).toString('utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`${where}: failed to parse keypair JSON: ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed) || !parsed.every((n) => typeof n === 'number' && n >= 0 && n <= 255)) {
    throw new Error(`${where}: keypair JSON must be an array of 64 byte values.`);
  }
  return new Uint8Array(parsed);
}
