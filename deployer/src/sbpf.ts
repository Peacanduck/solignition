/**
 * SBPF bytecode-version detection for uploaded program binaries.
 *
 * SIMD-0161 encodes the SBPF version in the ELF header's `e_flags`
 * (0 = legacy v0, 1..3 = v1..v3). Once SIMD-0500 activates on a cluster the
 * loader rejects deploys/upgrades of anything older than v3 -- and our deploy
 * only runs *after* the loan principal has been disbursed -- so the upload
 * route checks this up front, before a loan can be requested against the file.
 */

const ELF64_HEADER_LEN = 64;
const ELFCLASS64 = 2;
const ELFDATA2LSB = 1;
const E_MACHINE_OFFSET = 18;
const E_FLAGS_OFFSET = 48;

/** v3 must use EM_BPF; legacy toolchains also emitted EM_SBPF. */
const EM_BPF = 0xf7;
const EM_SBPF = 0x107;

export const MAX_KNOWN_SBPF_VERSION = 3;

export interface SbpfInfo {
  eMachine: number;
  eFlags: number;
  /** null when e_flags doesn't name a known SBPF version. */
  sbpfVersion: number | null;
}

/** Parse the ELF64 header; null if it isn't a little-endian ELF64 SBPF object. */
export function readSbpfInfo(buf: Buffer): SbpfInfo | null {
  if (buf.length < ELF64_HEADER_LEN) return null;
  if (buf[0] !== 0x7f || buf[1] !== 0x45 || buf[2] !== 0x4c || buf[3] !== 0x46) return null;
  if (buf[4] !== ELFCLASS64 || buf[5] !== ELFDATA2LSB) return null;

  const eMachine = buf.readUInt16LE(E_MACHINE_OFFSET);
  if (eMachine !== EM_BPF && eMachine !== EM_SBPF) return null;

  const eFlags = buf.readUInt32LE(E_FLAGS_OFFSET);
  const sbpfVersion = eFlags <= MAX_KNOWN_SBPF_VERSION ? eFlags : null;
  return { eMachine, eFlags, sbpfVersion };
}

export type SbpfCheck =
  | { ok: true; sbpfVersion: number | null }
  | { ok: false; code: 'bad_elf' | 'legacy_sbpf'; reason: string };

/**
 * Gate an upload on its SBPF version. Narrow failures with `'code' in result`
 * (the deployer compiles with `strict: false`, so `ok` alone doesn't narrow).
 * Unknown (future) versions pass -- the cluster is the authority on those; we
 * only enforce the configured floor.
 */
export function checkSbpfBinary(buf: Buffer, minVersion: number): SbpfCheck {
  const info = readSbpfInfo(buf);
  if (!info) {
    return {
      ok: false,
      code: 'bad_elf',
      reason: 'File is not a 64-bit little-endian Solana (SBPF) ELF binary',
    };
  }
  if (info.sbpfVersion !== null && info.sbpfVersion < minVersion) {
    return {
      ok: false,
      code: 'legacy_sbpf',
      reason:
        `Program is built for SBPFv${info.sbpfVersion}; this cluster requires ` +
        `SBPFv${minVersion} or newer. Rebuild with Anchor >= 1.2 (\`anchor build\`) ` +
        'or `cargo build-sbf --arch v3`.',
    };
  }
  return { ok: true, sbpfVersion: info.sbpfVersion };
}
