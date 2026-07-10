# Proof C: Spernakit SMB Infrastructure Dashboard

## Claim

AIDD's Spernakit lane can create and complete a substantial workspace-scoped application while
operating under Spernakit's full architecture, drift, line-limit, type, lint, build, contract, and
format gates.

## Recorded result

- 26 retained features passing and one retained non-passing remediation record.
- 27 commits in the embedded application repository.
- Recorded 30-step `bun run smoke:qc` pass.
- Asset inventory, relationships and impact analysis, services and ports, staged CSV import,
  reports, search, saved views, RBAC redaction, audit trails, settings, and crawl scenarios were
  delivered.

## Intervention and limitation

The create and build runs exposed real issues in workspace-root validation, Windows path casing,
template drift, quality-gate masking, abort-time commits, and approval context. The final source
snapshot is exported from committed `HEAD`, restoring public files that are deleted only in the raw
working tree.

The exact AIDD revision used for each launch was not captured. The retained evidence does not make
the campaign a current Spernakit conformance certification.

## Fresh replay on July 9, 2026

Passed `bun run smoke:qc` after a clean frozen-lockfile install. The drift step explicitly skipped
because the external Spernakit checkout is not part of this archive. Default config generation also
reported one expected placeholder-secret warning.

## Evidence

- [Original spec](spec.md)
- [Committed source snapshot](source/)
- [Structured AIDD evidence](evidence/)
- [Original commit ledger](commits.tsv)
