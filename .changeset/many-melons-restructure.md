---
"@solignition/frontend": minor
"@solignition/anchor-client": minor
---

Restructure the monorepo for independent, per-package releases.

- Extract the Vite app from the repo root into `apps/frontend` as `@solignition/frontend`.
- Split the Codama-generated program client into its own workspace package,
  `@solignition/anchor-client` (`clients/js`). The frontend still imports it via the
  existing `@project/anchor` alias, so no application code changed.
