# Existing Non-Spernakit App — Ingest Proof (build-proof d)

> **Build-proof (d): existing non-spernakit app.** Unlike (a)/(b)/(c), nothing is _built_ from a
> spec here — the point is to prove aidd can **ingest, profile, and audit a codebase it did not
> create, on a stack it does not use**. A Python / Flask app is the strongest evidence: clearly
> non-spernakit _and_ non-Bun.

## Choosing the app

Pick a **small, real, runnable** Flask app (not a toy you scaffold). Criteria: a handful of routes, a
data layer (SQLite/SQLAlchemy), and ideally its own tests (`pytest`) so there's a real validation
gate to point at.

Candidates (in rough order of size):

| Option                                | What                                                                        | Why                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **`flaskr`** _(rec)_                  | The official Flask tutorial blog (from `pallets/flask` `examples/tutorial`) | Tiny, real, has `pytest` tests and a SQLite schema — cleanest first ingest        |
| **RealWorld "Conduit" Flask backend** | A spec-complete Medium clone API                                            | Larger and more realistic — stronger audit surface, still self-contained + tested |
| **One of your own non-Bun projects**  | any existing app you have that isn't Node/Spernakit                         | Most authentic, if you have one                                                   |

Clone it into `<WORKSPACE>\<name>` **without** running aidd's create/scaffold — it must arrive as
an existing directory aidd merely discovers.

## What to run

Use the **Ingest** lane (Projects → Ingest Existing) or the `project-intake` recipe. Ingest is
**metadata-only** — it seeds `.aidd/` under a write allowlist and must never touch application code.
The intake chain runs: codebase analysis → interview → **profile inference** → artifact check →
feature coverage → feature review → testing scenarios → **audit** → audit-finding review → intake
report.

Steps:

1. Register/discover the cloned directory under a configured root; confirm the **intake preview**
   detects it (stack hints, git state, likely phase) as a Python/Flask project — **not** Bun/Node.
2. Run `project-intake` (metadata-only). Watch that it writes only under `.aidd/`.
3. Run an **audit** (e.g. `SECURITY`) against the ingested project and confirm it produces findings
   grounded in the actual Python code.
4. Review the generated feature coverage and the intake report.

## Success criteria

- **Stack-agnostic ingest:** the inferred `.aidd/project-profile.json` correctly identifies
  Python/Flask (stack, deployment, the app's own validation command — `pytest` if present), not a
  Bun/Node default.
- **No code mutation:** `git status` on the app shows changes only under `.aidd/`; application source
  is untouched (the write-allowlist held).
- **Audit works cross-stack:** the audit produces plausible, code-grounded findings for a Python
  codebase.
- **Feature coverage + intake report** generated and readable.
- The app's own gate (`pytest`) still passes afterward (proves ingest was non-destructive).

## Instrumentation (per the build-proofs plan)

Record: backend/model, elapsed per phase, **manual interventions**, and **failed assumptions** —
especially any place aidd assumed a Bun/Node/Spernakit stack, expected `bun run smoke:qc` on a Python
app, or mis-detected the project shape. File each such gap as a feature-backlog item. The headline
result is a yes/no: **did ingest → profile → audit → feature-coverage complete on a non-Bun app
without touching its source?**
