# Proof F: local-AI-only md-toc

## Claim

AIDD can route a fresh project entirely through a local LM Studio model without cloud API calls,
and its completion contract can reject incomplete agent work instead of recording false success.

## Recorded result

- All six retained build runs used `lmstudio` with `google/gemma-4-e4b`; no cloud backend appears
  in the run ledger.
- The initializer created a Bun/TypeScript scaffold and a sensible 14-feature backlog.
- Five coding runs completed zero features and emitted `AIDD_RESULT` zero times.
- 0 of 14 retained features passing; the partial source does not pass `bun run typecheck`.

## Intervention and limitation

The model's initial 8,192-token context was smaller than the initializer prompt. Reloading it with
a larger context allowed initialization to complete, but later coding runs repeatedly stopped
after planning or partial edits. The committed snapshot intentionally retains that non-compiling
near miss.

One raw feature record contains an invalid backslash-backtick JSON escape written during the local
run. Public curation removes that invalid escape while preserving the field's text; the private raw
archive remains unchanged.

This proof establishes local-only routing and honest failure handling. It does not establish that
this model can complete an AIDD coding workload.

## Evidence

- [Original spec](spec.md)
- [Committed source snapshot](source/)
- [Structured AIDD evidence](evidence/)
- [Original commit ledger](commits.tsv)
