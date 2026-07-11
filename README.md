# AIDD build proofs

This repository preserves public evidence from seven instrumented AIDD builds performed between
June 1 and July 11, 2026. The collection covers project creation, template ingestion, existing-app
ingestion, local-only inference, and an extended agent-driven application build. Each proof retains
the resulting source, structured AIDD artifacts, feature status, validation evidence, and a
scrubbed transcript archive.

This is historical first-party evidence. It is not an AIDD source backup, a current performance
benchmark, an independent audit, or a promise that later AIDD versions behave identically.

## Campaign

| Proof                                                                      | Lane                       | Result                             | Recorded validation |
| -------------------------------------------------------------------------- | -------------------------- | ---------------------------------- | ------------------- |
| [Habit Tracker](proofs/a-fresh-habit-tracker/README.md)                    | Fresh scaffold             | 25/25 features passing             | `bun run smoke:qc`  |
| [Kanban Board](proofs/b-template-kanban-board/README.md)                   | Third-party Vite template  | 23/23 features passing             | `bun run smoke:qc`  |
| [SMB Infrastructure Dashboard](proofs/c-spernakit-smb-dashboard/README.md) | Spernakit scaffold         | 26 passing, 1 retained remediation | `bun run smoke:qc`  |
| [Flaskr](proofs/d-existing-flaskr/README.md)                               | Existing Python app ingest | 22/22 retained features passing    | `pytest`            |
| [Pantry](proofs/e-github-template-pantry/README.md)                        | GitHub template            | 26/26 features passing             | Pester + analyzer   |
| [md-toc](proofs/f-local-ai-md-toc/README.md)                               | Local AI only              | 0/14 features passing              | Failed typecheck    |
| [MarginMinder](proofs/g-agent-driven-marginminder/README.md)               | Agent-driven build         | 29/29 retained features passing    | `bun run smoke:qc`  |

The [campaign narrative](CAMPAIGN.md) explains what the runs established, where manual
intervention was required, and which limitations matter when interpreting the results.

## Evidence hierarchy

Use the evidence in this order:

1. [`proofs/manifest.json`](proofs/manifest.json) is the machine-readable campaign contract.
2. Each proof README states the claim, recorded result, intervention, and limitation.
3. `proofs/*/evidence/` contains sanitized structured iterations, feature records, run ledgers,
   reports, and screenshots retained from the run.
4. `proofs/*/source/` is an export of the proof app's committed `HEAD`, excluding `.aidd`, raw
   logs, dependencies, databases, and build output.
5. The release asset carries the complete scrubbed transcript archive and checksum.

The source snapshots are accompanied by commit ledgers and original root/final commit identifiers.
The original nested Git repositories remain in the private raw archive and are not published as
cloneable histories.

## Important provenance limitation

The runs did not record the exact AIDD source revision at every launch. The campaign led into the
pre-public 2.9x release line, while AIDD's public Git history begins at
[`v2.102.0`](https://github.com/NomadicDaddy/aidd/releases/tag/v2.102.0). The proof narratives link
to the public changelog where the observed fixes were incorporated, but they do not claim a
reconstructable AIDD commit for each run.

## Verify the repository

Requires Bun 1.3.14 or newer:

```powershell
bun install --frozen-lockfile
bun run smoke:qc
```

The verifier checks manifest structure, artifact and tree hashes, feature and iteration counts,
license coverage, transcript metadata, forbidden generated files, private paths, and common secret
patterns. GitHub Actions runs the same gate on pushes and pull requests.

The current replay status for each archival app is recorded separately from its historical result
in `proofs/manifest.json`. A replay failure does not rewrite the historical source snapshot.

## Transcript redaction

The release archive normalizes local workspace and user-home paths and removes credential-shaped
values, private network addresses, machine identifiers, and unrelated local project names. Its
index records every logical source, published file, SHA-256 digest, size, and redaction category.

Model transcripts contain intermediate reasoning, tool output, failed attempts, and statements
that were later corrected. The manifest and final proof summaries take precedence.

## Licensing

- Original prose and evidence metadata: [CC BY 4.0](LICENSE-CC-BY-4.0.txt).
- Original generated example code without a more specific license: [MIT](LICENSE-MIT.txt).
- Flaskr retains the Pallets BSD license in its source snapshot.
- The SMB Infrastructure Dashboard retains its committed MIT license.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the complete mapping.

## AIDD

AIDD is local mission control for supervising AI coding agents across project planning, coding,
auditing, and review workflows: [github.com/NomadicDaddy/aidd](https://github.com/NomadicDaddy/aidd).
