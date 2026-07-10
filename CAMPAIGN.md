# July 2026 build-proofs campaign

The campaign tested four AIDD project intake paths one at a time. Each proof used Claude Code with
`claude-opus-4-8`, recorded run artifacts and manual intervention, and finished with the target
application's own validation gate.

## What the campaign established

- The fresh lane could select a stack from a prose spec, create a 25-feature backlog, and deliver a
  responsive full-stack Habit Tracker with real streak calculations.
- The registered-template lane could scaffold a third-party Vite/React starting point and build a
  persistent Kanban application with ten headless acceptance scenarios.
- The Spernakit lane could create and complete a larger, workspace-scoped infrastructure inventory
  while exercising the template's strict quality gates.
- The ingest lane could profile, audit, and extend a Python/Flask application without forcing AIDD's
  Bun/TypeScript stack onto it.

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

These findings fed AIDD and Spernakit fixes that were present by AIDD's initial public release. See
the [AIDD changelog at v2.102.0](https://github.com/NomadicDaddy/aidd/blob/v2.102.0/docs/CHANGELOG.md)
for the public version record.

## Interpretation boundaries

- The campaign is first-party historical evidence, not an independent evaluation.
- The exact AIDD revision at every launch was not captured and cannot be reconstructed from this
  repository.
- Feature totals describe retained campaign metadata, not the feature set of current AIDD releases.
- Elapsed times depended on one machine, one backend/model, and the state of the products during the
  campaign; they are not benchmark claims.
- Source snapshots are archival. Fresh replay results are recorded without rewriting those trees.

## Recorded outcomes

| Proof                        |                  Retained features | Embedded app commits | Recorded outcome                                       |
| ---------------------------- | ---------------------------------: | -------------------: | ------------------------------------------------------ |
| Habit Tracker                |                         25 passing |                   27 | Gate-clean fresh scaffold                              |
| Kanban Board                 |                         23 passing |                   26 | Gate-clean third-party-template build                  |
| SMB Infrastructure Dashboard | 26 passing, 1 retained remediation |                   27 | Full Spernakit gate recorded green                     |
| Flaskr                       |                         22 passing |                   33 | Cross-stack ingest plus security stretch, pytest green |

The exact commit identifiers, evidence hashes, iteration counts, and replay states live in
[`proofs/manifest.json`](proofs/manifest.json).
