# Proof D: existing Flaskr ingest

## Claim

AIDD can ingest, profile, and audit an existing non-Bun codebase without overwriting it with AIDD's
own stack. The initial metadata-only intake was followed by an explicit security-remediation stretch
to test AIDD writing idiomatic Python under the application's pytest gate.

## Recorded result

- 22 retained features passing, including the post-ingest stretch.
- 33 commits in the embedded application repository.
- Recorded pytest pass after intake and after the retained security work.
- Python/Flask/SQLite profile inference, grounded security findings, CSRF and session hardening,
  rate limiting, security headers, indexes, packaging/CI improvements, and pagination were retained.

## Intervention and limitation

Early intake and audit-role runs exposed scaffold and metadata write-boundary assumptions. Those
failures are part of the proof: the allowlist reverted out-of-scope writes, and later runs used the
correct stack-neutral path.

The exact AIDD revision used for each launch was not captured. The feature total includes work after
the original ingest-only claim, so the manifest and evidence distinguish the historical scope.

## Fresh replay on July 9, 2026

Passed 36 of 36 tests in a clean Python 3.14.6 virtual environment installed from the pinned
requirements files.

## Evidence

- [Original ingest brief](spec.md)
- [Committed source snapshot](source/)
- [Structured AIDD evidence](evidence/)
- [Original commit ledger](commits.tsv)
