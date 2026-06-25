import type { DeploymentRecord, FileUploadRecord } from './types';

/**
 * Build a fresh `pending` DeploymentRecord linking a loan to its uploaded
 * binary. Persisting this up front (in the loan/project route, before the
 * deploy is scheduled) is what makes an accepted borrow durable across a
 * deployer restart: the on-chain-driven reconciliation loop
 * (`checkPendingLoansForDeployment`) can only act on a loan that already has a
 * record, so without this the loan→binary link would live only in the
 * in-memory `setTimeout` that does the deploy.
 *
 * `principal` is a display-only placeholder here; it's refined during
 * processing and is not needed to perform the deploy (which only needs
 * `binaryPath`).
 */
export function buildPendingDeployment(
  loanId: string,
  borrower: string,
  fileUpload: Pick<FileUploadRecord, 'filePath' | 'binaryHash'>,
): DeploymentRecord {
  const now = Date.now();
  return {
    loanId,
    borrower,
    principal: '0',
    binaryPath: fileUpload.filePath,
    binaryHash: fileUpload.binaryHash,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    programAccountOpen: false,
  };
}
