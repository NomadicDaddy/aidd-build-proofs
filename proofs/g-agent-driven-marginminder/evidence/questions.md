# Onboarding Interview — Margin Minder

_Generated: 2026-06-08_
_Context: Final handoff questionnaire. You have one opportunity to ask these — the outgoing maintainers will be unreachable afterward._

## Legend

- **[CRITICAL]** Must answer before assuming ownership
- **[HIGH]** Significantly de-risks v1 delivery
- **[NICE]** Helpful context

---

## 1. Product Intent & Vision

- **[CRITICAL]** What does "v1 is done" look like beyond all features passing? Is there a specific customer, stakeholder, or event that is waiting for this release? What will they do with it once it ships?
- **[CRITICAL]** Who are the actual end users — are they you, a specific business, a hypothetical small service business, or something else? What kind of service business is the primary persona (contractor, trades, cleaning, IT services)?
- **[HIGH]** The spec describes two user personas (Owner-Operator and Office Manager) but the RBAC model has five tiers from the Spernakit scaffold. Are all five tiers expected to be used by real Margin Minder users, or should the product surface only present OPERATOR and VIEWER?
- **[HIGH]** Is Margin Minder meant to be a portfolio piece, a tool you will personally use day-to-day, or a product you intend to distribute to others? This changes how we prioritize polish vs. functionality.
- **[HIGH]** The spec says "avoid external services in the initial build." Is this a permanent architectural constraint or a simplifying decision for v1? What external service would be added first?
- **[NICE]** Are there any competitor products that inspired Margin Minder or that users currently use instead? Understanding what this replaces helps prioritize what matters most.
- **[NICE]** The spec mentions "Exportable plain-text or Markdown summary for reuse in proposals or email." What proposal or email tools do users currently paste this into? Does the Markdown format need to be compatible with any specific renderer?

## 2. Business Logic & Domain Rules

- **[CRITICAL]** The pricing formula defines "Gross profit = final price − tax amount − direct cost." This means margin is calculated on net-of-tax revenue, which is unusual for US service businesses where margin is typically calculated on the total price including tax. Is this formula intentionally net-of-tax, or was this an implementation choice that should be revisited?
- **[CRITICAL]** The pricing engine rounds intermediate money values to two decimals at each step (`roundMoney`). Some businesses carry full precision and round only at display; others round at each step. Which behavior matches the target users' expectations? Penny-level discrepancies can erode trust.
- **[HIGH]** The discount > 15% risk flag uses a hardcoded threshold. Is 15% a business rule from a specific company, or was it chosen as a reasonable default? Should this be configurable?
- **[HIGH]** The stale catalog assumption threshold is hardcoded at 90 days. Was this threshold chosen based on business domain knowledge, or was it a reasonable guess? Different cost categories (labor vs. materials) could have very different staleness windows.
- **[HIGH]** The spec defines four scenario statuses (draft, review, approved, archived) but does not require a transition order. Is there an intended workflow (draft → review → approved → archived), or can any status be set to any other status at any time? If there is a workflow, should the UI enforce it?
- **[HIGH]** When a cost catalog item is updated, existing scenario line items keep their copied values (copy-at-insertion). Is this the correct behavior for the target users, or would they expect scenarios to "follow" the catalog? The current design means a scenario can show a stale price without realizing it until the risk flag appears.
- **[NICE]** Is a zero contingency percentage valid? The risk flag warns about it, but should it be allowed at all?
- **[NICE]** Should a scenario be saveable with zero direct cost (no line items, labor, or fixed costs)? Currently it is allowed.
- **[NICE]** The spec defines a single tax rate per scenario. Do any target users need to model multiple tax jurisdictions (state + local) in a single quote?

## 3. Codebase & Architecture

- **[CRITICAL]** The config file `config/marginminder.json` contains what appear to be real JWT private keys, encryption keys, and API key secrets committed to the repository. Are these meant to be used in production, or are they development-only values that should be rotated before any real deployment? This is a security-critical question.
- **[CRITICAL]** What parts of the codebase are the most fragile or poorly understood? Where would a small change most likely break something unexpected? The CHANGELOG documents many UI interaction fixes across sessions 12–16 — are there remaining reliability concerns?
- **[HIGH]** The BBS/terminal aesthetic elements (scanline overlay, retro styling mentioned in session 16) appear to come from the Spernakit scaffold. Are these intentional for Margin Minder's product identity, or are they scaffold artifacts that should be removed for a business-oriented appearance?
- **[HIGH]** The pricing calculation engine (`pricingCalculationService.ts`) is a pure function with no side effects. Is this the intended pattern for all domain logic going forward, or were there trade-offs that future developers should understand?
- **[HIGH]** The scenario service is split across four files in `backend/src/services/scenario/` (calculations, crud, dashboard, types). Was this split driven by complexity, or was there a specific architectural decision? Would future domain services follow the same pattern?
- **[HIGH]** The Spernakit scaffold provides many foundation features (custom dashboards, file uploads, notifications, WebSocket, scheduled tasks, etc.) that are not part of Margin Minder's product scope. Should these remain enabled and visible in the UI, or should they be hidden/removed to reduce user confusion?
- **[NICE]** Are there any planned refactors that were deferred to meet the current delivery pace? The CHANGELOG mentions several sessions focused on UI defect fixes — were these symptoms of a deeper pattern issue?
- **[NICE]** The frontend defines API types independently in `frontend/src/api/types/` rather than importing from the backend. This is an explicit architectural choice. Has this caused any maintenance friction, and is there tooling to keep them in sync?

## 4. Data Model & Migrations

- **[CRITICAL]** The database currently runs on SQLite. The PostgreSQL schema parity files exist (`check:schema-parity` is a quality gate). Is PostgreSQL deployment actually planned, or is the parity maintenance a scaffold requirement? If PostgreSQL is not planned, can the parity check be relaxed to reduce maintenance burden?
- **[HIGH]** Only two SQL migrations exist: the v3.8.0 baseline and the Margin Minder domain schema. What is the expected migration strategy going forward? Should migrations be applied automatically on backend startup, or only via explicit `bun run db:migrate`?
- **[HIGH]** The seed data creates a specific scenario (Northstar Dental Group, id 20) with known risk flags. The seed is development-only and production seeding skips domain data. Is there a plan for initial production data — will users start with an empty catalog, or should there be industry templates?
- **[HIGH]** The `scenario_line_items` table has a nullable `catalog_item_id` foreign key. When a catalog item is archived, the foreign key reference remains. Is there any concern about orphaned references accumulating over time, or is the copy-at-insertion model sufficient?
- **[NICE]** The `last_reviewed_at` field on catalog items is nullable and is used for staleness risk flagging. Should this field be manually settable, auto-updated on edit, or both? The current behavior is not documented.
- **[NICE]** Is there a data retention or cleanup policy for archived scenarios? Should archived scenarios be permanently deletable, or is archive the only removal mechanism?

## 5. Infrastructure, Deployment & Environments

- **[CRITICAL]** The `docker-compose.yml` maps host port 3330 to container port 3440, but the config file specifies frontend port 3440 and backend 3441. The Dockerfile exposes port 3440 with nginx proxying the backend. What is the intended production deployment model — Docker with nginx, bare metal with the Bun dev process, or something else?
- **[HIGH]** The GitHub Container Registry is configured (`ghcr.io/nomadicdaddy/marginminder`). Is GHCR the actual deployment target, or is it configured for future use? Has the Docker image been tested in a real deployment?
- **[HIGH]** The config has `server.nodeEnv: "development"`. Is there a separate production config, or does the Docker entrypoint override this? How should environment-specific configuration be managed?
- **[HIGH]** The backup configuration uses local file storage (`./backups`) with AES-256-GCM encryption, but the `backupEncryptionKey` contains a placeholder string (`PRODUCTION_CHANGE_REQUIRED-...`). Is this a known issue that must be resolved before any real deployment?
- **[NICE]** The health check in the Dockerfile falls back to port 3330 if `FRONTEND_PORT` is not set, but the compose file sets `FRONTEND_PORT=3440`. Is this a potential source of confusion?
- **[NICE]** Is there any plan for a staging environment, or is the workflow strictly local development → Docker production?

## 6. Operations, Monitoring & Incident History

- **[HIGH]** Has the app ever been run outside of the development machine? Have there been any production-like tests, LAN deployments, or user acceptance tests? What happened?
- **[HIGH]** The CHANGELOG documents several sessions with `smoke:dev` timeouts (sessions 8, 9, 17, 18). Is this a known flaky behavior in the smoke test infrastructure, or does it indicate a real reliability issue?
- **[HIGH]** Sessions 14–16 document multiple UI interaction bugs (no-op buttons, fixed scanline overlay blocking clicks, action-bar viewport overflow). Are there remaining click-target or interaction reliability issues that haven't been filed?
- **[NICE]** The app has structured logging via pino and health check monitoring. Are there any specific log patterns or health check thresholds that indicate problems the new team should watch for?
- **[NICE]** Has the database ever been corrupted or required manual repair? SQLite can have issues with concurrent access or unclean shutdowns — has this been a problem?

## 7. Security, Auth & Compliance

- **[CRITICAL]** The config file contains real JWT private keys for both access and refresh tokens, plus an application API key, all committed in plaintext to the repository. What is the intended secret management strategy? Should these be moved to a secrets manager, or is the JSON config file considered sufficient for the local deployment model?
- **[HIGH]** The project profile says `dataSensitivity: "confidential"` and the backup encryption is enabled. What specific data is considered confidential — customer names, pricing assumptions, margin percentages? Does "confidential" mean "internal business data" or does it have a regulatory meaning?
- **[HIGH]** The five seeded development accounts (sysop through viewer) have well-known passwords. Is the seed data expected to be present in any environment other than local development? The seed skips domain data in production, but what about user accounts?
- **[HIGH]** The `security.cookieSecure: true` setting means cookies require HTTPS. In a local development context on `http://localhost:3440`, does this cause issues? Is there a mechanism to set this to `false` for local dev without modifying the config file?
- **[NICE]** CSRF protection is enabled with a 4-hour token TTL. Is there any known issue with CSRF tokens expiring during long editing sessions?
- **[NICE]** Rate limiting is currently disabled (`rateLimit.enabled: false`). Is this intentional for the local deployment model, or should it be enabled before any multi-user deployment?

## 8. Testing & Quality

- **[CRITICAL]** The testing strategy relies on `smoke:qc` (automated quality checks) and `crawltest` (browser-based page testing). There is no unit test framework. What is not tested that should be? Specifically, are the pricing calculation edge cases (zero direct cost, negative margin, rounding boundaries) sufficiently covered?
- **[HIGH]** The `smoke:qc` pipeline runs 16+ checks including drift, config, schema, typecheck, lint, build, API types, feature integration, schema parity, format, and dependency checks. Are any of these checks routinely flaky or known to pass when they shouldn't?
- **[HIGH]** The crawltest script tests individual pages for console and network errors. Does it test actual user workflows (create scenario → add items → save → verify summary), or only that pages load without errors?
- **[HIGH]** The testing scenarios file defines 15 manual test scenarios. Have all 15 been executed successfully? Are there known failures or skipped scenarios?
- **[NICE]** Is there a manual QA ritual that hasn't been documented — something the previous maintainer does by habit before considering a change safe to commit?

## 9. Dependencies & Third-Party Integrations

- **[HIGH]** The app depends on the Spernakit v3.8.2 template. What is the upgrade strategy when Spernakit releases updates? Is there a `template:sync-plan` workflow that has been tested, or would a Spernakit upgrade be a manual process?
- **[HIGH]** The project uses Puppeteer for crawltesting, which requires Chrome. The Docker build skips Puppeteer download (`PUPPETEER_SKIP_DOWNLOAD=true`). Is crawltesting only expected in local development, not in Docker?
- **[NICE]** Are there any dependencies that were considered and rejected during development? Any libraries that almost broke things or had compatibility issues with the Bun runtime?
- **[NICE]** The `knip` dependency is configured for dead code detection. Has it ever found significant dead code, or is it primarily a preventative measure?

## 10. Team Workflows & Conventions

- **[HIGH]** The CHANGELOG shows 25 sessions by what appears to be a single developer plus AI agents. What is the expected team size going forward? Will other humans work on this codebase, or is it primarily AI-agent-driven development?
- **[HIGH]** The risk-flagging feature had a blocker (session 7) that was resolved via `approval.source: "web-ui"`. What is the approval workflow for blocked features? Who approves, and how quickly can decisions be made?
- **[NICE]** The commit message convention uses conventional commits (`feat:`, `fix:`, `docs:`, `chore:`). Is this enforced by tooling or by convention? Are there additional conventions for AIDD-related changes (`chore(aidd):`)?
- **[NICE]** The `bun run smoke:qc` quality gate must pass before every commit. Is this enforced by git hooks, CI, or manual discipline? What happens when `smoke:qc` fails — is the commit blocked or is it a soft requirement?

## 11. Known Risks, Failure Points & Technical Debt

- **[CRITICAL]** What are the top 5 things that scare you about this codebase? Where are you most nervous about v1 reliability — what would keep you up at night if you were responsible for it in production?
- **[HIGH]** Multiple CHANGELOG sessions (12–16) were spent fixing UI interaction bugs (no-op buttons, click targets, viewport overflow). Is there a systemic issue with the UI component library or interaction patterns that could produce more of these bugs?
- **[HIGH]** The `affectedFiles` field in the risk-flagging feature metadata is empty (`[]`) even though the feature is completed. Are there other feature records with inaccurate metadata that the new team should know about?
- **[HIGH]** The config contains a `backupEncryptionKey` with a placeholder value that is clearly not production-ready. Are there other config values that look functional but would fail in a real deployment?
- **[NICE]** Is there technical debt that was intentionally deferred to ship faster? What would you refactor first if you had an extra week?
- **[NICE]** Are there any "here be dragons" areas in the codebase — code that works but is fragile, hard to understand, or that nobody wants to touch?

## 12. Roadmap & v1 Definition of Done

- **[CRITICAL]** All 29 features are marked completed with `passes: true`. Is the app actually done from the product owner's perspective? Is there anything that works technically but doesn't meet the real-world need?
- **[CRITICAL]** What remaining work is required before a v1 release tag? Is there anything beyond the current feature set — documentation, deployment testing, user acceptance, data migration, onboarding guides?
- **[HIGH]** The spec explicitly excludes payment processing, invoicing, accounting sync, OAuth, public sharing, multi-company tenancy, and third-party integrations. Which of these is most likely to be requested first after v1? Is there architectural preparation that should happen now to make any of these easier?
- **[HIGH]** The roadmap has four milestones (Foundation, Product MVP, Operations, Quality) with priorities 1–4. All are currently implemented. Is there a v1.1 milestone or post-release backlog that hasn't been captured yet?
- **[HIGH]** What is the timeline pressure? Is there a deadline, event, or customer expectation driving the release? How flexible is the scope if late issues are discovered?
- **[NICE]** If you could go back and make one different architectural decision at the start, what would it be? What did you learn building this that would change the approach?

---

## Summary

- **Total questions**: 56 (17 critical / 26 high / 13 nice)
- **Top 5 must-ask** (if you only had 10 minutes with the outgoing team):
    1. What does "v1 is done" actually mean to you — is a real customer waiting, and what will they do with it?
    2. What are the top 5 things that scare you about this codebase — what would keep you up at night?
    3. The config file has real JWT private keys and secrets committed to the repo. Is this development-only, or does it need to be rotated before any real deployment?
    4. Is PostgreSQL actually planned for production, or can the schema parity maintenance burden be reduced?
    5. What's the hardest-won lesson from building this that isn't written down anywhere?
- **Biggest unknowns identified during Phase 1**:
    - **Security posture**: Production secrets in version control with unclear rotation strategy
    - **Deployment reality**: Docker compose config is inconsistent with local dev config; unclear whether Docker has been tested end-to-end
    - **v1 completion criteria**: All features pass technically but there's no documented acceptance from a product owner
    - **Pricing formula correctness**: The net-of-tax gross profit formula may be unintentional and could undermine user trust
    - **Scaffold vs. product boundary**: Many Spernakit foundation features (custom dashboards, files, analytics, etc.) are enabled but not part of the Margin Minder product vision — unclear which should be hidden
