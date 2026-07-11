# Feature Coverage Audit - 2026-06-01

Target: `<WORKSPACE>/marginminder`

Mode: `--apply` equivalent via native skill workflow. The `feature-coverage-audit`
executable was not available as a direct shell command, so the audit was performed from
the skill instructions and validated with the AIDD CLI fallback from `<WORKSPACE>/aidd`.

## Coverage Summary

| Disposition                 | Count |
| --------------------------- | ----: |
| covered                     |    15 |
| feature-json-gap auto-fixed |    15 |
| doc-gap auto-fixed          |     2 |
| spec-backed backlog         |    14 |
| ambiguous                   |     0 |

## Coverage Matrix

| Capability                  | Implementation Evidence                                                                                                                                    | Natural Docs                         | Feature JSON                  | Spec Completeness                   | Confidence | Disposition |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------- | ----------------------------------- | ---------- | ----------- |
| App branding and config     | `package.json`, `config/marginminder.json`, `backend/src/config/defaults.json`, `frontend/index.html`                                                      | README and project structure updated | `app-branding-config`         | Complete for current scaffold state | high       | covered     |
| Authentication and RBAC     | `backend/src/routes/auth/index.ts`, `backend/src/plugins/auth.ts`, `backend/src/guards/role.ts`, `frontend/src/routes.tsx`                                 | README and template docs             | `authentication-rbac`         | Complete for current scaffold state | high       | covered     |
| User management             | `backend/src/routes/users/index.ts`, `backend/src/services/userService.ts`, `frontend/src/pages/settings/users/UsersTab.tsx`                               | README and template docs             | `user-management`             | Complete for current scaffold state | high       | covered     |
| Workspace management        | `backend/src/routes/workspaces/index.ts`, `backend/src/services/workspaceService.ts`, `frontend/src/pages/workspaces/WorkspaceManagementPage.tsx`          | README and template docs             | `workspace-management`        | Complete for current scaffold state | high       | covered     |
| Settings administration     | `backend/src/routes/settings/index.ts`, `frontend/src/pages/settings/SettingsLayout.tsx`                                                                   | README and template docs             | `settings-administration`     | Complete for current scaffold state | high       | covered     |
| Notifications and WebSocket | `backend/src/routes/notifications/index.ts`, `backend/src/routes/ws/index.ts`, `frontend/src/stores/wsStore.ts`                                            | README and template docs             | `notifications-websocket`     | Complete for current scaffold state | high       | covered     |
| Custom dashboards           | `backend/src/routes/dashboards/index.ts`, `backend/src/services/dashboardService.ts`, `frontend/src/pages/dashboards/`                                     | README and template docs             | `custom-dashboard-management` | Complete for current scaffold state | high       | covered     |
| File upload management      | `backend/src/routes/files/index.ts`, `backend/src/services/fileService.ts`, `frontend/src/pages/files/FilesPage.tsx`                                       | README and template docs             | `file-upload-management`      | Complete for current scaffold state | high       | covered     |
| Health monitoring           | `backend/src/create-api-app.ts`, `backend/src/routes/health/index.ts`, `frontend/src/pages/settings/health/SystemHealthTab.tsx`                            | README and template docs             | `health-monitoring`           | Complete for current scaffold state | high       | covered     |
| Audit log viewer            | `backend/src/routes/audit.ts`, `backend/src/services/auditService.ts`, `frontend/src/pages/settings/audit/AuditLogsTab.tsx`                                | README and template docs             | `audit-log-viewer`            | Complete for current scaffold state | high       | covered     |
| Backup administration       | `backend/src/routes/system/backup.ts`, `backend/src/services/backupService.ts`, `frontend/src/pages/settings/backup/BackupTab.tsx`                         | README and template docs             | `backup-administration`       | Complete for current scaffold state | high       | covered     |
| API key management          | `backend/src/routes/users/api-keys.ts`, `backend/src/services/apiKeyService.ts`, `frontend/src/pages/profile/ApiKeysTab.tsx`                               | README and template docs             | `api-key-management`          | Complete for current scaffold state | high       | covered     |
| Scheduler administration    | `backend/src/routes/tasks.ts`, `backend/src/services/schedulerService.ts`, `frontend/src/pages/settings/scheduler/ScheduledTasksTab.tsx`                   | README and template docs             | `scheduler-administration`    | Complete for current scaffold state | high       | covered     |
| Bug report intake           | `backend/src/routes/bugs.ts`, `backend/src/services/bugReportService.ts`, `frontend/src/components/layout/BugReportButton.tsx`                             | README and template docs             | `bug-report-intake`           | Complete for current scaffold state | high       | covered     |
| Business metrics analytics  | `backend/src/routes/business-metrics.ts`, `backend/src/services/metrics/businessMetricsService.ts`, `frontend/src/pages/analytics/BusinessMetricsPage.tsx` | README and template docs             | `business-metrics-analytics`  | Complete for current scaffold state | high       | covered     |

## Spec-Backed Backlog Created

The audit also created backlog feature records for product behavior required by
`.aidd/spec.md` but not implemented in code:

- `margin-data-schema`
- `cost-catalog-management`
- `quote-scenario-api`
- `scenario-list-page`
- `scenario-editor`
- `scenario-line-items`
- `scenario-labor-modeling`
- `scenario-fixed-costs`
- `pricing-calculation-engine`
- `risk-flagging`
- `pricing-dashboard`
- `scenario-comparison`
- `scenario-export-summary`
- `seed-quote-data`

## Auto-Fixes Applied

- Created 29 feature JSON files under `.aidd/features/`.
- Replaced the template-oriented `README.md` with a current-state onboarding README.
- Replaced the placeholder `.aidd/project-structure.md` with a repo-specific architecture
  and gap summary.
- Created `.aidd/todo.md` for the next implementation sessions.

## Remaining Gaps Requiring Dedicated Follow-Up

- `.aidd/assertions.md` is missing. Recommended flow: `/doc2feature` or an assertions
  refresh flow against `.aidd/spec.md`.
- `.aidd/roadmap.json` is missing. Recommended flow: `/update-roadmap`.
- `.aidd/project-profile.json` is missing. Recommended flow: project profile refresh.
- `.aidd/screen-map.md` is missing. Recommended flow: `/update-screen-map`.
- `.aidd/testing-scenarios.md` is missing. Recommended flow: `/testing-scenarios`.
- `.aidd/questions.md`, `.aidd/responses.md`, and `.aidd/responses/` are optional and
  missing; no action is needed unless an interview flow is planned.

## Ambiguous Boundaries

None. The boundary between implemented Spernakit scaffold capabilities and unimplemented
Margin Minder domain capabilities is clear in current code.

## Validator Result

- Feature metadata validation passed via `bun run start -- --project-dir <WORKSPACE>/marginminder --check-features` from `<WORKSPACE>/aidd`: 29 total, 29 valid, 0 invalid.
- Artifact check passed via `bun run start -- --project-dir <WORKSPACE>/marginminder --check-artifacts` from `<WORKSPACE>/aidd`: 3/11 present, 3 fresh, 0 stale, 8 missing.
- Artifact check JSON written to `.aidd/.artifacts-check.json`.
- Project quality gate passed via `bun run smoke:qc`.

## Recommended Follow-Up Commands

```text
/update-roadmap
/update-screen-map
/testing-scenarios
feature-review <WORKSPACE>/marginminder
```
