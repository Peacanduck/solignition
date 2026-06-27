import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loanStatusFor } from '../../api/routes/loans';
import type { DeploymentRecord } from '../../api/routes/types';

function rec(status: DeploymentRecord['status'], updatedAt = 1000): DeploymentRecord {
  return {
    loanId: '1',
    borrower: '11111111111111111111111111111111',
    status,
    principal: '0',
    programAccountOpen: status === 'deployed',
    createdAt: 1,
    updatedAt,
  };
}

test('no deployment record → pending, null updatedAt', () => {
  assert.deepEqual(loanStatusFor(null), { status: 'pending', updatedAt: null });
});

test('passes through pending/deploying/deployed/failed', () => {
  assert.equal(loanStatusFor(rec('pending')).status, 'pending');
  assert.equal(loanStatusFor(rec('deploying')).status, 'deploying');
  assert.equal(loanStatusFor(rec('deployed')).status, 'deployed');
  assert.equal(loanStatusFor(rec('failed')).status, 'failed');
});

test('recovering/recovered collapse to expired', () => {
  assert.equal(loanStatusFor(rec('recovering')).status, 'expired');
  assert.equal(loanStatusFor(rec('recovered')).status, 'expired');
});

test('carries through updatedAt', () => {
  assert.equal(loanStatusFor(rec('deployed', 4242)).updatedAt, 4242);
});
