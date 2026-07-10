# Proof B: third-party-template Kanban Board

## Claim

AIDD can start from a registered third-party Vite/React template, ingest that scaffold, translate a
spec into features, and complete a client-side application without replacing the chosen stack.

## Recorded result

- 23 of 23 retained features passing.
- 26 commits in the embedded application repository.
- Recorded `bun run smoke:qc` pass, including ten headless acceptance scenarios.
- Multi-board, column, and card management; drag-and-drop; filters; persistence validation;
  accessibility behavior; and responsive layouts were delivered.

## Intervention and limitation

The registered template initially passed an absolute Windows target to Create Vite, which produced
a mangled nested directory. Intake remediation metadata also caused the first coding launch to skip
spec-to-feature onboarding. Both problems were surfaced and corrected during the campaign.

The exact AIDD revision used for each launch was not captured. The source export uses committed
`HEAD` and intentionally excludes staged scaffold files left in the raw working tree.

## Fresh replay on July 9, 2026

Passed after a clean frozen-lockfile install: typecheck, lint, production build, format check, and
all ten scenarios completed successfully.

## Evidence

- [Original spec](spec.md)
- [Committed source snapshot](source/)
- [Structured AIDD evidence](evidence/)
- [Original commit ledger](commits.tsv)
