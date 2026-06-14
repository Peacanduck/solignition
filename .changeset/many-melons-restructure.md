---
"@solignition/frontend": minor
---

Restructure the monorepo for independent, per-package releases: extract the Vite
app from the repo root into `apps/frontend` as `@solignition/frontend`.

The Codama-generated program client lives in-tree at
`apps/frontend/src/anchor-client` (imported via the `@project/anchor` alias), and
the Anchor IDL/types are synced in with `npm run sync:anchor`, so the frontend
builds standalone with no dependency on the rest of the monorepo.
