---
'@solignition/deployer': minor
'@solignition/frontend': patch
'@solignition/docs': patch
---

SBPFv3: the deployer reports each upload's SBPF bytecode version (`sbpfVersion`) and can reject pre-v3 binaries via `MIN_SBPF_VERSION`; borrower-facing copy now asks for SBPFv3 builds.
