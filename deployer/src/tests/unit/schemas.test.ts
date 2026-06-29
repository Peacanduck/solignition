import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CreateProjectBody,
  Pubkey,
  LoanId,
  FileId,
  TxSignature,
  Uuid,
} from '../../api/schemas';

const validBorrower = '11111111111111111111111111111111'; // 32-char base58
const validSig = '5'.repeat(88); // 88-char base58, within 80..95
const validUuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const validFileId = '0a1b2c3d4e5f6789'; // 16 lowercase hex

const program = (loanId: string, fileId = validFileId) => ({ loanId, fileId });
const body = (programs: unknown[]) => ({
  projectId: validUuid,
  borrower: validBorrower,
  signature: validSig,
  programs,
});

test('CreateProjectBody accepts 2..4 programs', () => {
  assert.equal(CreateProjectBody.safeParse(body([program('1'), program('2')])).success, true);
  assert.equal(
    CreateProjectBody.safeParse(body([program('1'), program('2'), program('3'), program('4')]))
      .success,
    true,
  );
});

test('CreateProjectBody rejects fewer than 2 or more than 4 programs', () => {
  assert.equal(CreateProjectBody.safeParse(body([program('1')])).success, false);
  assert.equal(
    CreateProjectBody.safeParse(
      body([program('1'), program('2'), program('3'), program('4'), program('5')]),
    ).success,
    false,
  );
});

test('CreateProjectBody rejects a bad projectId or borrower', () => {
  assert.equal(
    CreateProjectBody.safeParse({ ...body([program('1'), program('2')]), projectId: 'not-a-uuid' })
      .success,
    false,
  );
  assert.equal(
    CreateProjectBody.safeParse({ ...body([program('1'), program('2')]), borrower: 'abc' }).success,
    false,
  );
});

test('primitive validators accept valid and reject invalid', () => {
  assert.equal(Pubkey.safeParse(validBorrower).success, true);
  assert.equal(Pubkey.safeParse('abc').success, false); // too short

  assert.equal(LoanId.safeParse('42').success, true);
  assert.equal(LoanId.safeParse('4.2').success, false);

  assert.equal(FileId.safeParse(validFileId).success, true);
  assert.equal(FileId.safeParse('XYZ').success, false); // not 16 lowercase hex

  assert.equal(TxSignature.safeParse(validSig).success, true);
  assert.equal(TxSignature.safeParse('tooshort').success, false);

  assert.equal(Uuid.safeParse(validUuid).success, true);
  assert.equal(Uuid.safeParse('nope').success, false);
});
