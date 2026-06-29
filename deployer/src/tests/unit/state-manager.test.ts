import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { StateManager } from '../../index';

/** Run `fn` with a fresh StateManager backed by a throwaway temp LevelDB dir. */
async function withStateManager(fn: (sm: StateManager) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'deployer-sm-test-'));
  const sm = new StateManager(dir);
  try {
    await fn(sm);
  } finally {
    await sm.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const A = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // 32-char base58-ish borrower
const B = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function project(projectId: string, borrower: string, loanIds: string[], updatedAt = Date.now()) {
  return {
    projectId,
    borrower,
    signature: '5'.repeat(88),
    programs: loanIds.map((loanId, index) => ({ loanId, fileId: '0a1b2c3d4e5f6789', index })),
    createdAt: 1,
    updatedAt,
  };
}

test('saveProject / getProject round-trips', async () => {
  await withStateManager(async (sm) => {
    const p = project('p1', A, ['1', '2']);
    await sm.saveProject(p);
    const got = await sm.getProject('p1');
    assert.deepEqual(got, p);
  });
});

test('getProject returns null when missing', async () => {
  await withStateManager(async (sm) => {
    assert.equal(await sm.getProject('nope'), null);
  });
});

test('getProjectsPage filters by borrower', async () => {
  await withStateManager(async (sm) => {
    await sm.saveProject(project('p1', A, ['1', '2']));
    await sm.saveProject(project('p2', B, ['3', '4']));
    await sm.saveProject(project('p3', A, ['5', '6']));

    const pageA = await sm.getProjectsPage({ borrower: A, limit: 50, offset: 0 });
    assert.equal(pageA.total, 2);
    assert.equal(pageA.projects.length, 2);
    assert.ok(pageA.projects.every((p) => p.borrower === A));
    assert.equal(pageA.hasMore, false);
  });
});

test('getProjectsPage paginates with hasMore', async () => {
  await withStateManager(async (sm) => {
    // 5 projects for the same borrower, distinct updatedAt for stable ordering
    for (let i = 0; i < 5; i++) {
      await sm.saveProject(project(`p${i}`, A, [`${i}`, `${i}x`], 1000 + i));
    }
    const first = await sm.getProjectsPage({ borrower: A, limit: 2, offset: 0 });
    assert.equal(first.projects.length, 2);
    assert.equal(first.total, 5);
    assert.equal(first.hasMore, true);
    // newest-first: updatedAt 1004, then 1003
    assert.deepEqual(
      first.projects.map((p) => p.projectId),
      ['p4', 'p3'],
    );

    const last = await sm.getProjectsPage({ borrower: A, limit: 2, offset: 4 });
    assert.equal(last.projects.length, 1);
    assert.equal(last.hasMore, false);
  });
});

test('deployment round-trips and is independent of projects', async () => {
  await withStateManager(async (sm) => {
    await sm.saveDeployment({
      loanId: '7',
      borrower: A,
      status: 'pending',
      principal: '0',
      programAccountOpen: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const d = await sm.getDeployment('7');
    assert.equal(d?.status, 'pending');
    assert.equal(d?.borrower, A);
    // a project key must not leak into deployment reads
    assert.equal(await sm.getDeployment('p1'), null);
  });
});
