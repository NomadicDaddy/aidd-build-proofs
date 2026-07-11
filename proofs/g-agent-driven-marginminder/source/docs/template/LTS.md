# Spernakit v3.8 LTS Policy

**Status:** v3.8.0 is the **terminal v3 release**. v3 is now Long-Term Support (LTS) — patch-only.
**Tag:** `v3.8.0-lts`
**Effective:** 2026-05-05
**Supersedes:** ad-hoc bumping cadence on the v3 line.

This document is the **only gate** for what may land on the v3 line after the LTS tag. There is no `release/v3.8-lts` branch; main IS the LTS line. If a future v3.9 (or v4) is ever cut, it branches from main at that moment and a retroactive `release/v3.8-lts` branch is taken from the LTS tag at the same time. Until that moment, every commit on main must satisfy this policy.

## What qualifies for a v3.8.x patch

A commit may land on the v3 LTS line **only if** it falls into one of these categories:

1. **Security CVEs** — fixes for CVEs against spernakit's own code or its direct dependencies. Severity is not a gate; "if a CVE applies, fix it." For dependency CVEs, prefer minimum-viable bumps (e.g., the smallest patch range that resolves the advisory) over speculative upgrades.
2. **Correctness fixes** — bugs that produce wrong output, data loss, RBAC bypass, auth bypass, destructive-action regressions (a confirmation dialog disappearing, a migration applying without backup, etc.), or migration failures.
3. **Documentation corrections** — typos, broken links, factually wrong statements. Re-organization or rewording for taste does not qualify.
4. **Dance-blocking template drift** — a template change required to unbreak the propagation pipeline for active fleet apps. This is the only "tooling" exception. Refactoring scripts because they could be cleaner does NOT qualify.
5. **Critical observability** — adding a single log line or correlation-ID propagation to make an existing production incident debuggable. Does not include "improve logging" sweeps.

## What does NOT qualify

- New features, however small.
- New API routes, new schema columns, new pages, new components, new plugins, new guards.
- Refactors — including "cleanup," extraction of helpers, renaming, splitting files, decomposing handlers.
- Performance improvements that are not fixing a customer-reported regression.
- Dependency upgrades that are not security advisories.
- Changes to the destructive-confirmation, drift, or other `check:*` scripts that tighten the rules — those move to the v3.9/v4 line.
- shadcn/ui primitive upgrades.
- React/Vite/Bun major version bumps — even if they're advertised as backwards-compatible.

If you are uncertain whether a change qualifies, the answer is **no** — file an issue and let v3.9/v4 take it.

## Renovate / dependency-bump policy

Only **security advisories** trigger updates on the LTS line. The repo's Renovate configuration (or equivalent) must be scoped to:

- Group: `vulnerable-only`
- Schedule: `at any time` (security advisories should not wait for batch windows)
- Auto-merge: only after CI passes, and only if the bump is patch-level on a transitive dependency.

Any direct dependency bump — even a security one — requires a maintainer-approved PR and an entry in `CHANGELOG.md` under the v3.8.x patch release.

The lockfile is **frozen**: `bun.lock` may not change without `LTS_LOCKFILE_BUMP=1` set in the environment when running the bump. The `check:lockfile-frozen` script enforces this in CI.

## Branching strategy

Main is the LTS line. There is **no separate LTS branch** unless and until a v3.9/v4 is cut.

When (and if) v3.9 happens:

1. Tag the current main HEAD as `v3.8.x-lts-final` (where x is the most recent LTS patch).
2. Cut `release/v3.8-lts` from `v3.8.x-lts-final`.
3. Main becomes the v3.9 development line.
4. Backports from main to `release/v3.8-lts` are still subject to this policy.

Until that moment: main is the LTS line, full stop.

## Criteria for cutting v3.9

A v3.9 (or v4) is **only justified** if at least one of:

- A **runtime security model change** is required (e.g., a new auth scheme to address a class of CVEs, not just a single CVE).
- A **load-bearing dependency** ships a major version that breaks v3's public API contract and the old version becomes unmaintained or insecure.
- A **paying customer** has signed off on funding the next major.
- The fleet has accumulated **three or more derived-app patterns** that cannot be expressed within the v3 template surface — and at least one of them is documented as a real friction point, not a theoretical one.

"We've been pent up to ship features" is not a v3.9 trigger. The whole point of LTS is to make pent-up demand visible and force the conversation to be deliberate.

## Patch-release workflow

When a qualifying fix lands:

1. Author the fix on a branch off main.
2. CHANGELOG entry under a new `## v3.8.x — YYYY-MM-DD` heading. Single line per change.
3. PR title format: `fix(security): ...` | `fix(correctness): ...` | `fix(docs): ...` | `fix(tooling): ...` | `fix(observability): ...`. Other prefixes will be rejected by review.
4. CI must pass `smoke:qc`, `supertest`, `check:lts-surface` (which compares the public API/config/env surface against `docs/lts-baseline/` snapshots — additions fail the build), and `check:lockfile-frozen`.
5. Tag `v3.8.x` on merge. Push tag.
6. Run the dance to propagate to fleet — same machinery, just narrower scope.

## Surface freeze

Three surfaces are frozen at v3.8.0 and snapshotted in `docs/lts-baseline/`:

- **API surface** — `docs/lts-baseline/openapi.json`. New routes, new request/response fields, removed routes/fields all fail `check:lts-surface`.
- **Config schema** — `docs/lts-baseline/config-schema.json`. New keys, removed keys, type changes all fail.
- **Environment surface** — `docs/lts-baseline/env-shape.json`. New `process.env` reads fail. (Spernakit prefers JSON config and reads almost no env — this guard is to prevent regression to env-driven config.)
- **Database schema** — `docs/lts-baseline/db-schema.sql`. New columns, removed columns, type changes all fail. Adding indexes is allowed if the index is non-unique, additive, and documented as a correctness-or-performance fix.
- **Secrets shape** — new secret keys require an ADR. `check:secrets-shape` enforces.

Adding to a snapshot is a v3.9 act, not a v3.8.x act.

## Derived-fleet implications

This policy applies to **spernakit itself**. Derived apps (aidd-web, ottoboard, deeper, etc.) continue normal cadence. The LTS contract says "the template you build on is stable" — it does not constrain what apps do with the template.

When an active-fleet app finds a bug that traces to a shared template pattern, the fix lands on spernakit under one of the qualifying categories above and rides the next dance to the fleet. The triage step (`§A` of the LTS plan, `docs/lts-baseline/triage-dance-followups.md` for v3.8.0) is the canonical record of how that decision was made.

## Exceptions

Exceptions to this policy require:

1. A new ADR explaining the deviation.
2. The ADR linked from the next CHANGELOG entry.
3. The exception note added to this file under a new `## Exceptions` section.

If an exception is granted three or more times, that is a signal to evaluate whether v3.9 is justified — see "Criteria for cutting v3.9" above.

## See also

- `docs/template/adr/adr-010-v38-lts.md` — decision rationale
- `docs/template/CHANGELOG.md` — patch history
- `docs/template/KNOWN_ISSUES.md` — accepted-and-living-with bugs at LTS
- `docs/template/MIGRATION_V37_TO_V38.md` — upgrade guide for derived apps
- `docs/lts-baseline/` — snapshot evidence
