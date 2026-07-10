# Proof A: fresh Habit Tracker

## Claim

AIDD's fresh lane can turn a prose product spec into a new full-stack application, choose a viable
stack, create a feature backlog, implement real domain behavior, and leave the app passing its own
quality gate.

## Recorded result

- 25 of 25 retained features passing.
- 27 commits in the embedded application repository.
- Recorded `bun run smoke:qc` pass.
- Habit CRUD, daily check-ins, current and longest streak calculations, dashboard, weekly grid,
  responsive behavior, theme persistence, and crawl scenarios were delivered.

## Intervention and limitation

The initializer ended after scaffolding and required a separate coding launch. The main coding run
also reached its timeout with two features remaining and required another launch. This established
the application path while exposing the lack of automatic run continuation.

The exact AIDD revision used for each launch was not captured. Fresh replay status is recorded in
the campaign manifest and is separate from the historical result.

## Fresh replay on July 9, 2026

Failed after a clean root install. The committed root manifest does not declare or install the
backend/frontend workspaces, so lint reports unresolved frontend dependency types. The archival
source remains unchanged; this does not rewrite the recorded campaign pass.

## Evidence

- [Original spec](spec.md)
- [Committed source snapshot](source/)
- [Structured AIDD evidence](evidence/)
- [Original commit ledger](commits.tsv)
