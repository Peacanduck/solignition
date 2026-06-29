---
"@solignition/deployer": minor
"@solignition/frontend": minor
---

Multi-program "project" deployments: bundle 2–4 program loans into one
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
