/**
 * Zod schemas + OpenAPI registrations for the v1 REST API.
 *
 * Every request body, response, URL param, and query parameter the API
 * accepts is defined here. The route wrapper in `./route-wrapper.ts`
 * validates each request against these schemas before the handler runs;
 * `./openapi.ts` walks the registry to emit `openapi.json`.
 *
 * Changing a schema is a public contract change — bump the CHANGELOG.
 */
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// ── Primitive validators ───────────────────────────────────────────────────
// Solana pubkeys are 32-byte ed25519 keys encoded in base58 (32–44 chars,
// always 43–44 in practice). The strict length+charset check here is the
// single source of truth for borrower / loan / authority pubkey fields and
// closes the unbounded-string-key risk on URL params.
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
export const Pubkey = z
  .string()
  .min(32)
  .max(44)
  .regex(BASE58_RE, 'must be base58')
  .openapi({ example: '11111111111111111111111111111111', description: 'Solana base58 pubkey' });

// On-chain u64. We accept the string form because JS numbers can't hold u64
// safely; conversion to `anchor.BN` happens in the handler.
export const LoanId = z
  .string()
  .min(1)
  .max(20)
  .regex(/^\d+$/, 'must be a decimal u64 string')
  .openapi({ example: '42', description: 'On-chain loan id (u64 as string)' });

// FileId is sha256(borrower + Date.now()).substring(0, 16) — 16 lowercase hex chars.
export const FileId = z
  .string()
  .length(16)
  .regex(/^[a-f0-9]{16}$/, 'must be 16 lowercase hex chars')
  .openapi({ example: '0a1b2c3d4e5f6789' });

// Transaction signatures are 64-byte ed25519 sigs in base58 (87–88 chars).
export const TxSignature = z
  .string()
  .min(80)
  .max(95)
  .regex(BASE58_RE, 'must be base58')
  .openapi({ example: '5j7s...', description: 'Solana transaction signature (base58)' });

export const Sha256Hex = z
  .string()
  .length(64)
  .regex(/^[a-f0-9]{64}$/, 'must be 64 lowercase hex chars');

// ── Record schemas (responses) ─────────────────────────────────────────────
export const DeploymentStatus = z.enum([
  'pending',
  'deploying',
  'deployed',
  'recovering',
  'recovered',
  'failed',
]);

export const FileUploadStatus = z.enum(['pending', 'ready', 'deployed']);

// Aggregated loan lifecycle status — what `step-status.tsx` wants to render.
// Derived from the deployment record + on-chain loan state.
export const LoanStatus = z.enum([
  'pending',
  'uploading',
  'deploying',
  'deployed',
  'failed',
  'repaid',
  'expired',
]);

export const DeploymentRecord = z
  .object({
    loanId: LoanId,
    borrower: Pubkey,
    programId: Pubkey.optional(),
    deploymentCost: z.number().optional(),
    deployTxSignature: TxSignature.optional(),
    setDeployedTxSignature: TxSignature.optional(),
    recoveryTxSignature: TxSignature.optional(),
    status: DeploymentStatus,
    error: z.string().optional(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    binaryHash: Sha256Hex.optional(),
    binaryPath: z.string().optional(),
    principal: z.string(),
    programAccountOpen: z.boolean(),
  })
  .openapi('DeploymentRecord');

export const FileUploadRecord = z
  .object({
    fileId: FileId,
    borrower: Pubkey,
    fileName: z.string(),
    filePath: z.string(),
    fileSize: z.number().int().nonnegative(),
    binaryHash: Sha256Hex,
    estimatedCost: z.number(),
    status: FileUploadStatus,
    createdAt: z.number().int(),
  })
  .openapi('FileUploadRecord');

export const ErrorResponse = z
  .object({
    error: z.string(),
    code: z.string().optional(),
    requestId: z.string().optional(),
  })
  .openapi('ErrorResponse');

// ── Pagination ─────────────────────────────────────────────────────────────
// Server-side cap of 200 closes the `getAllByBorrower` DB-scan DoS noted in
// the audit; default of 50 matches what the frontend was passing.
export const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const PaginatedUploads = z
  .object({
    uploads: z.array(FileUploadRecord),
    total: z.number().int().nonnegative(),
    limit: z.number().int(),
    offset: z.number().int(),
    hasMore: z.boolean(),
  })
  .openapi('PaginatedUploads');

export const PaginatedDeployments = z
  .object({
    deployments: z.array(DeploymentRecord),
    total: z.number().int().nonnegative(),
    limit: z.number().int(),
    offset: z.number().int(),
    hasMore: z.boolean(),
  })
  .openapi('PaginatedDeployments');

// ── Request bodies ─────────────────────────────────────────────────────────
// POST /v1/loans — borrower notifies us that they signed a `request_loan` tx.
export const CreateLoanBody = z
  .object({
    signature: TxSignature,
    borrower: Pubkey,
    loanId: LoanId,
    fileId: FileId,
  })
  .openapi('CreateLoanBody');

export const CreateLoanResponse = z
  .object({
    success: z.literal(true),
    message: z.string(),
    signature: TxSignature,
    fileId: FileId,
  })
  .openapi('CreateLoanResponse');

// POST /v1/loans/:loanId/repayments — borrower notifies us they signed `repay_loan`.
export const CreateRepaymentBody = z
  .object({
    signature: TxSignature,
    borrower: Pubkey,
  })
  .openapi('CreateRepaymentBody');

export const CreateRepaymentResponse = z
  .object({
    success: z.literal(true),
    message: z.string(),
    loanId: LoanId,
    auth: Pubkey,
    tx: z.string().optional(),
  })
  .openapi('CreateRepaymentResponse');

// POST /v1/uploads — multipart: file + borrower (+ expectedHash for Step 3.4).
// Multipart isn't expressible as a Zod schema for the file part, so we only
// validate the form fields here; multer handles the file stream itself.
export const CreateUploadFormFields = z
  .object({
    borrower: Pubkey,
    expectedHash: Sha256Hex.optional().openapi({
      description:
        'sha256(file) computed by the client. If provided, the server rejects with 422 when the computed hash does not match.',
    }),
  })
  .openapi('CreateUploadFormFields');

export const CreateUploadResponse = z
  .object({
    success: z.literal(true),
    fileId: FileId,
    estimatedCost: z.number(),
    binaryHash: Sha256Hex,
    message: z.string(),
  })
  .openapi('CreateUploadResponse');

// POST /v1/jobs/expired-loan-check — kicks off the maintenance job.
export const JobAcceptedResponse = z
  .object({
    success: z.literal(true),
    message: z.string(),
    jobId: z.string(),
  })
  .openapi('JobAcceptedResponse');

// GET /v1/loans/:loanId/status — what the frontend's step-status.tsx wants.
export const LoanStatusResponse = z
  .object({
    loanId: LoanId,
    status: LoanStatus,
    deployment: DeploymentRecord.nullable(),
    updatedAt: z.number().int().nullable(),
  })
  .openapi('LoanStatusResponse');

// GET /health
export const HealthResponse = z
  .object({ status: z.literal('ok') })
  .openapi('HealthResponse');

// ── Path/query param schemas ───────────────────────────────────────────────
export const LoanIdParam = z.object({ loanId: LoanId });
export const FileIdParam = z.object({ fileId: FileId });
export const DeploymentListQuery = PaginationQuery.extend({
  borrower: Pubkey.optional(),
});
export const UploadListQuery = PaginationQuery.extend({
  borrower: Pubkey.optional(),
  status: FileUploadStatus.optional(),
});

// ── Projects (multi-program deployments) ───────────────────────────────────
// A "project" bundles 2–4 program loans created in a single signed
// transaction. Grouping is off-chain metadata only; each program stays its own
// on-chain Loan + DeploymentRecord. The frontend joins on-chain loans with this
// metadata. See the "## API — multi-program" CHANGELOG entry.

// Cap a project at 4 bundled `request_loan` instructions (one transaction's
// size limit); never offer more. Min 2 — a single-program borrow uses /v1/loans.
export const MIN_PROGRAMS_PER_PROJECT = 2;
export const MAX_PROGRAMS_PER_PROJECT = 4;

// Client-generated UUID, passed in on create so a re-POST is idempotent
// (mirrors the "notify after sign" model of POST /v1/loans).
export const Uuid = z
  .string()
  .uuid()
  .openapi({
    example: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    description: 'Client-generated project id (UUID v4)',
  });

// Optional human label for a project or one of its program slots.
const ProjectName = z.string().min(1).max(64);

// Aggregate project status, derived from the per-program deployment records by
// `aggregateProjectStatus()` in routes/projects.ts.
export const ProjectStatus = z
  .enum(['pending', 'deploying', 'partial', 'deployed', 'failed'])
  .openapi('ProjectStatus');

// One program inside a project (stored form; `index` is its position 0..N-1,
// matching its `request_loan` instruction order in the bundled transaction).
export const ProjectProgramRef = z
  .object({
    loanId: LoanId,
    fileId: FileId,
    index: z.number().int().nonnegative(),
    name: ProjectName.optional(),
  })
  .openapi('ProjectProgramRef');

export const ProjectRecord = z
  .object({
    projectId: Uuid,
    borrower: Pubkey,
    name: ProjectName.optional(),
    signature: TxSignature,
    programs: z
      .array(ProjectProgramRef)
      .min(MIN_PROGRAMS_PER_PROJECT)
      .max(MAX_PROGRAMS_PER_PROJECT),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .openapi('ProjectRecord');

// POST /v1/projects — one program slot in the request body. `index` is assigned
// server-side from array order, so the client only sends loanId/fileId/name.
const CreateProjectProgram = z
  .object({
    loanId: LoanId,
    fileId: FileId,
    name: ProjectName.optional(),
  })
  .openapi('CreateProjectProgram');

export const CreateProjectBody = z
  .object({
    projectId: Uuid,
    borrower: Pubkey,
    signature: TxSignature,
    name: ProjectName.optional(),
    programs: z
      .array(CreateProjectProgram)
      .min(MIN_PROGRAMS_PER_PROJECT)
      .max(MAX_PROGRAMS_PER_PROJECT),
  })
  .openapi('CreateProjectBody');

export const CreateProjectResponse = z
  .object({
    success: z.literal(true),
    message: z.string(),
    projectId: Uuid,
    signature: TxSignature,
    programs: z.array(ProjectProgramRef),
  })
  .openapi('CreateProjectResponse');

// Per-program enriched status, returned by GET /v1/projects/:projectId.
export const ProjectProgramStatus = z
  .object({
    loanId: LoanId,
    fileId: FileId,
    index: z.number().int().nonnegative(),
    name: ProjectName.optional(),
    status: LoanStatus,
    deployment: DeploymentRecord.nullable(),
  })
  .openapi('ProjectProgramStatus');

export const ProjectAggregateResponse = z
  .object({
    project: ProjectRecord,
    status: ProjectStatus,
    programs: z.array(ProjectProgramStatus),
  })
  .openapi('ProjectAggregateResponse');

// Lightweight aggregate for list views (no per-program deployment records).
export const ProjectSummary = z
  .object({
    project: ProjectRecord,
    status: ProjectStatus,
  })
  .openapi('ProjectSummary');

export const PaginatedProjects = z
  .object({
    projects: z.array(ProjectSummary),
    total: z.number().int().nonnegative(),
    limit: z.number().int(),
    offset: z.number().int(),
    hasMore: z.boolean(),
  })
  .openapi('PaginatedProjects');

// POST /v1/projects/:projectId/repayments — borrower signed N bundled
// `repay_loan` instructions; loanIds are read from the stored project.
export const CreateProjectRepaymentBody = z
  .object({
    signature: TxSignature,
    borrower: Pubkey,
  })
  .openapi('CreateProjectRepaymentBody');

export const ProjectRepaymentResponse = z
  .object({
    success: z.literal(true),
    message: z.string(),
    projectId: Uuid,
    programs: z.array(z.object({ loanId: LoanId, auth: Pubkey })),
  })
  .openapi('ProjectRepaymentResponse');

export const ProjectIdParam = z.object({ projectId: Uuid });
export const ProjectListQuery = PaginationQuery.extend({
  borrower: Pubkey.optional(),
});

// ── OpenAPI security scheme registration ───────────────────────────────────
// The custom wallet-signature scheme is best expressed in OpenAPI as a set
// of apiKey-in-header schemes ANDed together. Clients have to send all four.
registry.registerComponent('securitySchemes', 'solignitionAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'X-Auth-Pubkey',
  description:
    'solignition-auth-v1: send X-Auth-Pubkey, X-Auth-Timestamp, X-Auth-Nonce, X-Auth-Signature. See deployer/src/auth.ts for the canonical message format.',
});
