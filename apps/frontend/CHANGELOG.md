# @solignition/frontend

## 0.2.0

### Minor Changes

- 30d0fc6: Restructure the monorepo for independent, per-package releases: extract the Vite
  app from the repo root into `apps/frontend` as `@solignition/frontend`.

  The Codama-generated program client lives in-tree at
  `apps/frontend/src/anchor-client` (imported via the `@project/anchor` alias), and
  the Anchor IDL/types are synced in with `npm run sync:anchor`, so the frontend
  builds standalone with no dependency on the rest of the monorepo.

- 2f566ea: Multi-program "project" deployments: bundle 2–4 program loans into one
  borrow → deploy → repay flow with a single wallet signature, while each program
  stays independently recoverable.

  Deployer — new additive `/v1/projects` endpoints (create / get-aggregate / list /
  repay) that group loans off-chain. Each program keeps its own on-chain `Loan` and
  `DeploymentRecord`; per-program deploy and authority-transfer side effects are
  error-isolated so one failure never blocks the rest. `aggregateProjectStatus`
  collapses the per-program statuses into `pending | deploying | partial | deployed |
failed`. No on-chain program changes.

  Frontend — the borrow wizard now supports up to 4 program slots; when more than one
  is added, the N `request_loan` instructions are bundled into a single transaction
  (one signature) and the deployer is notified via `POST /v1/projects`. The dashboard
  groups a project's loans under one header with a single "repay project" button
  (N `repay_loan` instructions, one signature). Single-program borrows are unchanged
  — they keep using `/v1/loans` and never create a project.

- 8c11485: Add Vercel Web Analytics to the frontend, landing, and docs, plus Speed Insights on the frontend.

  All three apps mount `<Analytics />` (`@vercel/analytics/react`) at their root; the frontend
  also mounts `<SpeedInsights />` (`@vercel/speed-insights/react`). This is cookieless,
  privacy-friendly page view / visitor tracking plus Core Web Vitals — no env vars and no
  consent banner. The beacons only fire in production on Vercel; local dev is a no-op. Speed
  Insights is frontend-only because the free Vercel plan scopes it to a single project; Web
  Analytics and Speed Insights still need to be enabled per project in the Vercel dashboard
  for collection to start.
