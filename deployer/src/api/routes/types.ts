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
  transferDeployedProgramAuth(loanId: string, borrowerPubkey: PublicKey): Promise<string>;
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
