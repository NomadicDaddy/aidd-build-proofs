# June-July 2026 build-proofs collection

The collection combines the original four-lane July campaign with three additional proofs. The
original campaign used Claude Code with `claude-opus-4-8`; the additions cover a GitHub-template
build with the same backend, a local-only LM Studio run, and an earlier supervised Codex build of
MarginMinder. Passing and non-passing outcomes are both retained.

## What the campaign established

- The fresh lane could select a stack from a prose spec, create a 25-feature backlog, and deliver a
  responsive full-stack Habit Tracker with real streak calculations.
- The registered-template lane could scaffold a third-party Vite/React starting point and build a
  persistent Kanban application with ten headless acceptance scenarios.
- The Spernakit lane could create and complete a larger, workspace-scoped infrastructure inventory
  while exercising the template's strict quality gates.
- The ingest lane could profile, audit, and extend a Python/Flask application without forcing AIDD's
  Bun/TypeScript stack onto it.
- The GitHub-template lane could clone Podex without inherited history, profile a foreign stack,
  and turn it into a working Pantry application with 26 passing features.
- The local-AI lane could initialize a sensible TypeScript backlog without cloud calls, while its
  five coding attempts honestly failed the completion contract and left all 14 features non-passing.
- The agent-driven lane could supervise Codex across a multi-day Spernakit application build, then
  retain subsequent audit, remediation, and feature-consolidation evidence.

## What required intervention

The runs were dogfood exercises, so failures were retained rather than edited out of the story.
The main interventions were:

- Fresh and long-running coding work needed manual continuation because runs did not auto-chain.
- The initial Vite template command mishandled an absolute Windows target, and intake initially
  allowed remediation metadata to skip spec-to-feature onboarding.
- Foreign-stack intake exposed scaffold and write-boundary assumptions before the Flask path became
  stack-neutral.
- The Spernakit proof exposed path comparison, template drift, masked quality gates, abort-time
  commit, and approval-context problems.
- Pantry required a manual baseline commit after the GitHub-template clone and separate launches
  between intake, onboarding, coding, and audit work.
- md-toc required a larger local-model context window, then exposed an execution ceiling: the model
  made partial edits but never emitted `AIDD_RESULT` or completed a feature.
- MarginMinder was intentionally supervised across many agent runs rather than presented as a
  single autonomous build.

Findings from the original four-lane campaign fed AIDD and Spernakit fixes that were present by
AIDD's initial public release. See the
[AIDD changelog at v2.102.0](https://github.com/NomadicDaddy/aidd/blob/v2.102.0/docs/CHANGELOG.md)
for that public version record. The three additional proofs retain their later findings separately.

## Interpretation boundaries

- The campaign is first-party historical evidence, not an independent evaluation.
- The exact AIDD revision at every launch was not captured and cannot be reconstructed from this
  repository.
- Feature totals describe retained campaign metadata, not the feature set of current AIDD releases.
- Elapsed times depended on one machine, one backend/model, and the state of the products during the
  campaign; they are not benchmark claims.
- Source snapshots are archival. Fresh replay results are recorded without rewriting those trees.
- The MarginMinder snapshot includes later agent-driven hardening beyond its initial product build.
- md-toc is evidence of correct failure handling and local-only routing, not a successful app build.

## Recorded outcomes

| Proof                        |                  Retained features | Embedded app commits | Recorded outcome                                       |
| ---------------------------- | ---------------------------------: | -------------------: | ------------------------------------------------------ |
| Habit Tracker                |                         25 passing |                   27 | Gate-clean fresh scaffold                              |
| Kanban Board                 |                         23 passing |                   26 | Gate-clean third-party-template build                  |
| SMB Infrastructure Dashboard | 26 passing, 1 retained remediation |                   27 | Full Spernakit gate recorded green                     |
| Flaskr                       |                         22 passing |                   33 | Cross-stack ingest plus security stretch, pytest green |
| Pantry                       |                         26 passing |                   50 | GitHub-template build, Pester and analyzer green       |
| md-toc                       |                     14 non-passing |                    4 | Local-only initialization; coding contract not met     |
| MarginMinder                 |                         29 passing |                   72 | Supervised Codex build plus later agent hardening      |

The exact commit identifiers, evidence hashes, iteration counts, and replay states live in
[`proofs/manifest.json`](proofs/manifest.json).
