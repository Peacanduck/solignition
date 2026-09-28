// Anchor post-build hook (see `[hooks]` in Anchor.toml).
//
// Anchor 1.2's `#[event_cpi]` constrains `event_authority` with
// `address = crate::EVENT_AUTHORITY_AND_BUMP.0` instead of
// `seeds = [b"__event_authority"], bump`, and the IDL generator can't resolve
// that const -- so the IDL loses the PDA seeds. On-chain nothing changed (same
// PDA), but without the seeds Codama turns `eventAuthority` into a required
// input instead of auto-deriving it, breaking the frontend's instruction
// builders on the next `codama:js`. Put the seeds back so the IDL (and the
// generated TS types) stay as they were.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const anchorRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = [...Buffer.from('__event_authority')];

function restore(idl, accountName) {
  let patched = 0;
  for (const ix of idl.instructions) {
    for (const acc of ix.accounts) {
      if (acc.name === accountName && !acc.pda && !acc.address) {
        acc.pda = { seeds: [{ kind: 'const', value: SEED }] };
        patched++;
      }
    }
  }
  return patched;
}

// target/idl/*.json -- plain pretty-printed JSON, no trailing newline.
const idlPath = resolve(anchorRoot, 'target/idl/solignition.json');
const idl = JSON.parse(readFileSync(idlPath, 'utf8'));
const idlPatched = restore(idl, 'event_authority');
writeFileSync(idlPath, JSON.stringify(idl, null, 2));

// target/types/*.ts -- the camelCase IDL as a JSON-shaped TS type literal.
const typesPath = resolve(anchorRoot, 'target/types/solignition.ts');
const PREFIX = 'export type Solignition = ';
const ts = readFileSync(typesPath, 'utf8');
const start = ts.indexOf(PREFIX) + PREFIX.length;
const end = ts.lastIndexOf(';');
const typesIdl = JSON.parse(ts.slice(start, end));
const typesPatched = restore(typesIdl, 'eventAuthority');
writeFileSync(typesPath, ts.slice(0, start) + JSON.stringify(typesIdl, null, 2) + ts.slice(end));

console.log(`restored event_authority PDA seeds: ${idlPatched} in IDL, ${typesPatched} in types`);
