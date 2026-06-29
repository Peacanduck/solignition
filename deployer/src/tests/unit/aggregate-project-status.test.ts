import { test } from 'node:test';
import assert from 'node:assert/strict';

import { aggregateProjectStatus } from '../../api/routes/projects';

// Per-program statuses come from loanStatusFor: pending | uploading | deploying
// | deployed | failed | repaid | expired.

test('empty project is pending', () => {
  assert.equal(aggregateProjectStatus([]), 'pending');
});

test('all programs deployed → deployed', () => {
  assert.equal(aggregateProjectStatus(['deployed', 'deployed', 'deployed']), 'deployed');
});

test('repaid counts as success (deployed)', () => {
  assert.equal(aggregateProjectStatus(['deployed', 'repaid']), 'deployed');
});

test('all programs failed → failed', () => {
  assert.equal(aggregateProjectStatus(['failed', 'failed']), 'failed');
});

test('expired counts as failure (all failed)', () => {
  assert.equal(aggregateProjectStatus(['failed', 'expired']), 'failed');
});

test('mixed terminal (some deployed, some failed) → partial', () => {
  assert.equal(aggregateProjectStatus(['deployed', 'failed']), 'partial');
  assert.equal(aggregateProjectStatus(['deployed', 'expired', 'repaid']), 'partial');
});

test('anything still in progress → deploying (never partial yet)', () => {
  assert.equal(aggregateProjectStatus(['deploying', 'pending']), 'deploying');
  assert.equal(aggregateProjectStatus(['uploading', 'pending']), 'deploying');
  // a failure + a success but one still deploying is not settled → deploying
  assert.equal(aggregateProjectStatus(['deployed', 'failed', 'deploying']), 'deploying');
});

test('partial progress with nothing in flight → deploying', () => {
  // one deployed, rest not started, no active worker
  assert.equal(aggregateProjectStatus(['deployed', 'pending']), 'deploying');
});

test('nothing started → pending', () => {
  assert.equal(aggregateProjectStatus(['pending', 'pending']), 'pending');
});
