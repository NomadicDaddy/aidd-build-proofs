# Proof G: agent-driven MarginMinder

## Claim

AIDD can supervise Codex across a sustained, feature-by-feature Spernakit application build while
retaining the run ledger, per-iteration evidence, commits, validation claims, and later agent-led
quality work.

## Recorded result

- 29 of 29 retained features passing.
- 72 commits in the embedded application repository.
- 48 retained AIDD iterations spanning the initial build, product completion, release work,
  audits, remediation, and feature consolidation.
- Recorded `bun run smoke:qc` passes throughout the product build and at the v0.1.0 release
  candidate.
- Pricing scenarios, cost catalogs, margin calculations, risk flags, comparison, exports,
  dashboard workflows, and supporting Spernakit operations were delivered.

## Intervention and limitation

MarginMinder was an agent-driven build test, not a claim of one-shot autonomy. The operator launched
and supervised multiple Codex runs, resolved approval decisions, and used directive and audit runs
for later hardening. Subsequent GLM-backed audit work is included in the retained evidence, while
the primary product-build runs used Codex with `gpt-5.5`.

The public source is the committed `HEAD` snapshot. Later uncommitted maintenance changes in the
private raw archive are deliberately excluded.

## Evidence

- [Original spec](spec.md)
- [Committed source snapshot](source/)
- [Structured AIDD evidence](evidence/)
- [Original commit ledger](commits.tsv)
