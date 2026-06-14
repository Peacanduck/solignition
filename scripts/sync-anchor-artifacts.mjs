// Copies the Anchor build artifacts the frontend imports directly (the raw IDL
// JSON and the generated TS types) from `anchor/target/` into the frontend so
// `apps/frontend` stays self-contained and builds in isolation (e.g. on Vercel
// without access to the rest of the monorepo).
//
// Run after `anchor build` (it's wired into `npm run setup`). The codama client
// at apps/frontend/src/anchor-client is regenerated separately by `codama:js`.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const copies = [
  ['anchor/target/idl/solignition.json', 'apps/frontend/src/anchor-idl/solignition.json'],
  ['anchor/target/types/solignition.ts', 'apps/frontend/src/anchor-idl/solignition.ts'],
];

for (const [from, to] of copies) {
  const src = resolve(repoRoot, from);
  const dest = resolve(repoRoot, to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`synced ${from} -> ${to}`);
}
