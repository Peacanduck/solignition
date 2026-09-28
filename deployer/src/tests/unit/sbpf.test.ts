import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkSbpfBinary, readSbpfInfo } from '../../sbpf';

// Minimal ELF64 header: magic, class, data, e_machine @18, e_flags @48.
function elfHeader(opts: { eMachine?: number; eFlags?: number; eiClass?: number; eiData?: number } = {}): Buffer {
  const buf = Buffer.alloc(64);
  buf.set([0x7f, 0x45, 0x4c, 0x46], 0);
  buf[4] = opts.eiClass ?? 2;
  buf[5] = opts.eiData ?? 1;
  buf.writeUInt16LE(opts.eMachine ?? 0xf7, 18);
  buf.writeUInt32LE(opts.eFlags ?? 0, 48);
  return buf;
}

test('legacy v0 header (EM_SBPF, e_flags 0) → v0', () => {
  assert.deepEqual(readSbpfInfo(elfHeader({ eMachine: 0x107, eFlags: 0 })), {
    eMachine: 0x107,
    eFlags: 0,
    sbpfVersion: 0,
  });
});

test('v3 header (EM_BPF, e_flags 3) → v3', () => {
  assert.equal(readSbpfInfo(elfHeader({ eFlags: 3 }))?.sbpfVersion, 3);
});

test('unknown e_flags → null version', () => {
  assert.equal(readSbpfInfo(elfHeader({ eFlags: 0x20 }))?.sbpfVersion, null);
});

test('32-bit ELF is rejected', () => {
  assert.equal(readSbpfInfo(elfHeader({ eiClass: 1 })), null);
});

test('big-endian ELF is rejected', () => {
  assert.equal(readSbpfInfo(elfHeader({ eiData: 2 })), null);
});

test('non-BPF machine (x86-64) is rejected', () => {
  assert.equal(readSbpfInfo(elfHeader({ eMachine: 62 })), null);
});

test('truncated header is rejected', () => {
  assert.equal(readSbpfInfo(elfHeader().subarray(0, 40)), null);
});

test('min 0 accepts legacy v0', () => {
  assert.deepEqual(checkSbpfBinary(elfHeader({ eMachine: 0x107 }), 0), { ok: true, sbpfVersion: 0 });
});

test('min 3 rejects v0 as legacy_sbpf', () => {
  const r = checkSbpfBinary(elfHeader({ eMachine: 0x107 }), 3);
  assert.equal(r.ok, false);
  assert.equal('code' in r && r.code, 'legacy_sbpf');
});

test('min 3 accepts v3', () => {
  assert.deepEqual(checkSbpfBinary(elfHeader({ eFlags: 3 }), 3), { ok: true, sbpfVersion: 3 });
});

test('non-SBPF ELF → bad_elf', () => {
  const r = checkSbpfBinary(elfHeader({ eMachine: 62 }), 0);
  assert.equal('code' in r && r.code, 'bad_elf');
});
