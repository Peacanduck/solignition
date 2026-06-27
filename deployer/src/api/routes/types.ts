/**
 * Dependency surface for route registrar functions.
 *
 * Route files import only `RouteDeps` and avoid pulling in any concrete
 * class from index.ts, which keeps the dependency graph one-way:
 *   index.ts → routes/* (never the reverse).
 *
 * The structural `*Like` interfaces describe the slice of each collaborator
 * the routes actually use, so future refactors of StateManager etc. don't
 * ripple into here unless they change methods that handlers call.
 */
import type { Multer } from 'multer';
import type winston from 'winston';
import type { PublicKey } from '@solana/web3.js';
import type { Counter } from 'prom-client';

import type { AuthMode } from '../../auth';
import type { RateLimiters } from '../middleware';

// Plain interface mirrors of the runtime record shapes. We deliberately do
// NOT use `z.infer<typeof schemas.FileUploadRecord>` here because
// @asteasolutions/zod-to-openapi's `.openapi()` extension on inner
// primitives makes every field optional in inferred output (their
// returned wrapper loses the required-ness flag). The schemas in
// `../schemas.ts` remain the runtime validation source of truth; these
// types are the compile-time shape contract.
export interface FileUploadRecord {
  fileId: string;
  borrower: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  binaryHash: string;
  estimatedCost: number;
  status: 'pending' | 'ready' | 'deployed';
  createdAt: number;
}

export interface DeploymentRecord {
  loanId: string;
  borrower: string;
  programId?: string;
  deploymentCost?: number;
  deployTxSignature?: string;
  setDeployedTxSignature?: string;
  recoveryTxSignature?: string;
  status: 'pending' | 'deploying' | 'deployed' | 'recovering' | 'recovered' | 'failed';
  error?: string;
  createdAt: number;
  updatedAt: number;
  binaryHash?: string;
  binaryPath?: string;
  principal: string;
  programAccountOpen: boolean;
}

/**
 * Off-chain grouping metadata that bundles 2–4 program loans into one
 * "project". The DeploymentRecord per loanId stays the single source of truth
 * for deploy status; ProjectRecord only records the grouping. `index` is each
 * program's position (0..N-1), matching its `request_loan` instruction order in
 * the bundled transaction.
 */
export interface ProjectProgramRef {
  loanId: string;
  fileId: string;
  index: number;
  name?: string;
}

export interface ProjectRecord {
  projectId: string;
  borrower: string;
  name?: string;
  signature: string;
  programs: ProjectProgramRef[];
  createdAt: number;
  updatedAt: number;
}

export interface StateManagerLike {
  getDeployment(loanId: string): Promise<DeploymentRecord | null>;
  saveDeployment(record: DeploymentRecord): Promise<void>;
  getAllDeployments(): Promise<DeploymentRecord[]>;
  saveFileUpload(record: FileUploadRecord): Promise<void>;
  getFileUpload(fileId: string): Promise<FileUploadRecord | null>;
  getAllFileUploadsByBorrower(borrower: string): Promise<FileUploadRecord[]>;
  getFileUploadsByBorrowerAndStatus(
    borrower: string,
    status?: FileUploadRecord['status'],
  ): Promise<FileUploadRecord[]>;
  getAllFileUploads(): Promise<FileUploadRecord[]>;
  /** Paginated, cap-bounded list (closes the full-DB-scan DoS noted in the audit). */
  getFileUploadsPage(opts: {
    borrower?: string;
    status?: FileUploadRecord['status'];
    limit: number;
    offset: number;
  }): Promise<{ uploads: FileUploadRecord[]; total: number; hasMore: boolean }>;
  /** Paginated, cap-bounded list of deployments. */
  getDeploymentsPage(opts: {
    borrower?: string;
    limit: number;
    offset: number;
  }): Promise<{ deployments: DeploymentRecord[]; total: number; hasMore: boolean }>;
  // ── Projects (multi-program grouping) ──
  getProject(projectId: string): Promise<ProjectRecord | null>;
  saveProject(record: ProjectRecord): Promise<void>;
  /** Paginated, cap-bounded list of projects (mirrors getDeploymentsPage). */
  getProjectsPage(opts: {
    borrower?: string;
    limit: number;
    offset: number;
  }): Promise<{ projects: ProjectRecord[]; total: number; hasMore: boolean }>;
}

export interface BinaryManagerLike {
  storeBinary(
    fileId: string,
    sourcePath: string,
  ): Promise<{ hash: string; destinationPath: string }>;
  estimateDeploymentCost(filePath: string): Promise<number>;
}

export interface OrchestratorLike {
  checkExpiredLoans(): Promise<void>;
  /** Resolves to the transfer tx signature, or `null` if the loan wasn't awaiting transfer (already done / not eligible). */
  transferDeployedProgramAuth(loanId: string, borrowerPubkey: PublicKey): Promise<string | null>;
  processDeploymentWithRetries(deployment: DeploymentRecord): Promise<void>;
}

export interface DeployerMetrics {
  fileUploads: Counter<string>;
  validationRejected: Counter<string>;
  authFailures: Counter<string>;
}

export interface DeployerConfigSlice {
  authMode: AuthMode;
  maxUploadBytes: number;
  uploadPath: string;
}

/**
 * `processLoanFromSignature` is owned by index.ts (it depends on the
 * Solana Connection + the orchestrator's deployment pipeline). Routes
 * receive it as a callback so the loan-creation handler can fire it
 * without re-binding to ApiServer.
 */
export type ProcessLoanFromSignatureFn = (
  signature: string,
  borrower: string,
  fileUpload: FileUploadRecord,
  loanId: string,
) => Promise<void>;

export interface RouteDeps {
  stateManager: StateManagerLike;
  binaryManager: BinaryManagerLike;
  /** Set after construction by ApiServer.setOrchestrator; may be undefined briefly during boot. */
  orchestrator: () => OrchestratorLike | null;
  multer: Multer;
  rateLimit: RateLimiters;
  /** Build a fresh requireAuth middleware tagged with the route's endpoint label. */
  authMw: (endpoint: string) => import('express').RequestHandler;
  logger: winston.Logger;
  metrics: DeployerMetrics;
  config: DeployerConfigSlice;
  processLoanFromSignature: ProcessLoanFromSignatureFn;
}
