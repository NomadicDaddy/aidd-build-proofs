# ADR-010: v3.8 as Terminal LTS Release of the v3 Line

## Status

Accepted

## Context

Spernakit reached v3.7.2 with 98/98 features complete, zero TODO/FIXME/HACK markers in source, and a healthy smoke gate. Despite that, commit churn was high — 650 commits in 30 days, 385 in 14 days, almost all refactor/polish work. Every active fleet app (aidd-web, ottoboard, sketchysuspects, groundtruth, tribewall, deeper, aidd-squad) has been propagating template changes weekly via the dance pipeline.

The cost of that cadence is concrete:

- Derived apps spend a non-trivial fraction of their cycle absorbing template refactors that have no user-visible benefit.
- The dance machinery itself surfaces template drift faster than it surfaces real bugs, because the template is the thing changing.
- Each refactor pass introduces a small but non-zero regression surface — the morning of 2026-05-04, two separate dances had to land on the same day to absorb fixes from drift caused by the previous refactor cycle.
- Maintainer attention is consumed by template housekeeping rather than fleet-level feature work.

The team needs a stability commitment. Either (a) the v3 line stops accepting refactors and becomes patch-only, or (b) v3 keeps churning and derived apps adopt a "pin and skip" strategy. Option (b) re-creates exactly the divergence problem the dance pipeline was designed to prevent.

This ADR codifies option (a): v3.8 is the terminal v3 release. The v3 line is now LTS — patch-only.

## Decision Drivers

- **Fleet-cycle reclamation**: derived apps need stable template ground to build features on. A weekly refactor absorbs maintainer attention that should be going to user-facing work.
- **Refactor regression risk**: each polish pass on the template carries a small chance of introducing a regression that ripples through 7 apps. The aggregate cost is invisible until something breaks.
- **No paying customer for v4**: there is no funded driver pulling for new template capabilities. The pent-up "improvements" are author-driven, not user-driven.
- **Surface stability is the product**: derived apps trust that "spernakit v3" means a specific API/config/schema surface. A refactor that keeps the surface identical still rotates code reviewers' mental models — and ones that don't break the surface AND aren't author-driven are extremely rare.
- **Dance-pipeline hardening complete**: by the time of this ADR, the dance has run cleanly enough times that the propagation cost is well-understood. The remaining churn is on spernakit's side.

## Considered Alternatives

### Alternative 1: Continue v3 cadence, no LTS designation

Pros:

- No new policy to maintain.
- Allows whatever refactor or feature lands next.

Cons:

- Continues the high-churn cycle that motivated this ADR.
- Derived apps cannot meaningfully plan around template stability.
- Each new refactor pass is a regression surface for 7 apps.

### Alternative 2: Cut v4 immediately, leave v3 unsupported

Pros:

- Clean break.
- Future development unconstrained.

Cons:

- 7 active apps would have to migrate to v4 with no transition period.
- No funded driver for v4 work — what would v4 even do differently?
- Loses the v3 investment with no upside.

### Alternative 3: v3.8 LTS on main, no branch split (CHOSEN)

Pros:

- Caps refactor churn at v3.8.0 — anything beyond that requires either a CVE or a deliberate v3.9 conversation.
- Active fleet keeps benefiting from security/correctness fixes via the dance, with predictable patch-only scope.
- Branch split is deferred — until v3.9 is actually justified, main is the LTS line. Less branch management overhead, simpler mental model.
- The policy itself (LTS.md) is the gate, not a separate branch. This forces the conversation about every commit to happen at PR time, not at merge time.

Cons:

- Requires discipline to enforce the patch-only rule on main without a branch separation.
- Future v3.9 conversion (cutting `release/v3.8-lts` retroactively) is a non-zero amount of work, though small.
- "Tag-only" strategy depends on `LTS.md` being treated as load-bearing policy, not advisory documentation.

### Alternative 4: v3.8 LTS on a separate `release/v3.8-lts` branch, main becomes v3.9

Pros:

- Clean physical separation: anyone on the LTS branch knows what they're getting.
- Main is unconstrained for future work.

Cons:

- No funded driver for v3.9, so main becomes a parking lot for unreleased refactors.
- Doubles the surface that has to be maintained — every fix has to be considered for both lines.
- Re-creates the "two parallel codebases" problem the dance pipeline was designed to avoid.

## Decision Outcome

**Chosen alternative: Alternative 3** — v3.8 as LTS on main, no branch split, policy-gated.

**Why this alternative was chosen:**

- Caps churn without committing to a v3.9 that has no driver.
- Main remaining the LTS line keeps mental overhead low; one place to look, one set of guards.
- Policy enforcement (`LTS.md`, `check:lts-surface`, `check:lockfile-frozen`) is more explicit than branch separation would be — every PR has to argue against a written rule, not just "is it on the right branch."
- Branch split is deferred to the moment v3.9 is actually justified. If that moment never comes, there's no orphaned branch to maintain.

## Consequences

### Positive

- Active fleet apps gain predictable template stability.
- Maintainer attention shifts from template polish to fleet-level features.
- The CHANGELOG becomes legible — every entry under v3.8.x is a security or correctness fix, not a refactor.
- Surface freeze (`docs/lts-baseline/`) creates diffable evidence of what the contract actually is.
- The hardening guards (`check:lts-surface`, `check:lockfile-frozen`, `check:dependency-versions` hard-failing on `^`/`~` ranges) make accidental drift impossible rather than discouraged.

### Negative

- New template improvements are blocked indefinitely — anything author-driven has to wait for v3.9, which has no funded date.
- The patch-only rule will feel restrictive in cases where a small refactor would simplify a fix. The fix has to land first; the refactor lives in the v3.9 backlog if v3.9 ever happens.
- If v3.9 is eventually cut, the retroactive `release/v3.8-lts` branch creation is a small but non-zero piece of work.
- Discipline-dependent: if a maintainer lands a refactor under a `fix:` prefix, the policy is bypassed. CI guards (`check:lts-surface`) catch surface changes but cannot catch internal-only refactors. This relies on review culture.

## Criteria for triggering a v3.9 conversation

Documented in `docs/template/LTS.md` under "Criteria for cutting v3.9":

- Runtime security model change required (not just a single CVE)
- Load-bearing dependency major version that breaks v3 public surface AND old version unmaintained
- Funded customer driver
- Three or more derived-app patterns that cannot be expressed within v3's template surface

If none of these apply, v3.9 does not happen. "Pent-up demand" is not on the list — that is by design.

## Related ADRs

- `adr-005-json-configuration.md` — surface stability commitment for config (now codified as a freeze).
- `adr-009-rate-limit-policy.md` — example of a written policy gating template change; LTS.md follows the same pattern at scale.
- (future) `adr-XXX-v39-trigger.md` — would document the decision to actually cut v3.9, if it ever happens.
