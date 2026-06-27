import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPendingDeployment } from '../../api/routes/deployment-record';

const upload = {
  filePath: '/binaries/abc123_deadbeef.so',
  binaryHash: 'a'.repeat(64),
};

test('builds a pending record linking the loan to its binary', () => {
  const before = Date.now();
  const d = buildPendingDeployment('42', 'BorrowerPubkey1111111111111111111111111111', upload);
  const after = Date.now();

  assert.equal(d.loanId, '42');
  assert.equal(d.borrower, 'BorrowerPubkey1111111111111111111111111111');
  assert.equal(d.status, 'pending');
  assert.equal(d.binaryPath, upload.filePath);
  assert.equal(d.binaryHash, upload.binaryHash);
  assert.equal(d.programAccountOpen, false);
  // principal is a display-only placeholder, refined during processing
  assert.equal(d.principal, '0');
  // timestamps are set to "now"
  assert.ok(d.createdAt >= before && d.createdAt <= after);
  assert.equal(d.updatedAt, d.createdAt);
});
