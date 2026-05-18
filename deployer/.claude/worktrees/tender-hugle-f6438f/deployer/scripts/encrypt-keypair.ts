/**
 * Migration helper: encrypt a plaintext Solana keypair JSON into an `.age` file.
 *
 * Usage:
 *   ts-node scripts/encrypt-keypair.ts <input.json> <output.age>
 *
 * Reads the passphrase interactively (no echo) and writes the ciphertext to
 * <output.age>. The input file is left untouched — verify the encrypted file
 * loads successfully (e.g. `npm run dev` with the matching *_PASSPHRASE env)
 * before deleting the plaintext copy.
 */
import * as fs from 'fs/promises';
import * as readline from 'readline';
import { Encrypter } from 'age-encryption';

async function readPassphrase(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(prompt);
    // Disable echo so the passphrase doesn't show on screen.
    const stdin = process.stdin as NodeJS.ReadStream & { isTTY?: boolean };
    if (stdin.isTTY) {
      stdin.on('data', mask);
    }
    rl.question('', (answer) => {
      if (stdin.isTTY) {
        stdin.removeListener('data', mask);
        process.stdout.write('\n');
      }
      rl.close();
      resolve(answer);
    });
  });
}

function mask(_chunk: Buffer): void {
  // no-op masking — readline will still print prompt, we just don't echo input
}

async function main(): Promise<void> {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: ts-node scripts/encrypt-keypair.ts <input.json> <output.age>');
    process.exit(1);
  }

  const plaintext = await fs.readFile(inputPath, 'utf8');
  // Validate it's a real keypair JSON before encrypting.
  const parsed = JSON.parse(plaintext);
  if (!Array.isArray(parsed) || parsed.length !== 64) {
    throw new Error(`${inputPath} does not look like a Solana keypair JSON (expected 64-element number array).`);
  }

  const passphrase = await readPassphrase(`Passphrase for ${outputPath}: `);
  const confirm = await readPassphrase('Confirm passphrase: ');
  if (passphrase !== confirm) {
    console.error('Passphrases did not match.');
    process.exit(1);
  }
  if (passphrase.length < 12) {
    console.error('Passphrase is too short (minimum 12 characters).');
    process.exit(1);
  }

  const encrypter = new Encrypter();
  encrypter.setPassphrase(passphrase);
  const ciphertext = await encrypter.encrypt(plaintext);

  await fs.writeFile(outputPath, ciphertext);
  console.log(`✓ Wrote encrypted keypair to ${outputPath}`);
  console.log(`  Verify it loads with the matching *_PASSPHRASE env var before deleting ${inputPath}.`);
}

main().catch((err) => {
  console.error('Encryption failed:', err);
  process.exit(1);
});
