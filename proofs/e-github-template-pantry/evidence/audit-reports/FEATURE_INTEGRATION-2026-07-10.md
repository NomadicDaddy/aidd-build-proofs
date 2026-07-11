<!-- aidd:audit-report-meta {"generatedAt":"2026-07-10T14:45:27.549Z","gitHead":"44abbe33f3fd26915bf064da15141f9c7d4b86a1","version":1} -->

# FEATURE_INTEGRATION Audit Report - 2026-07-10

Route/caller reachability traced across podex.ps1 and views/. The only integration break (`/htmx/item-new` vs registered `/htmx/crudmgr-new`, plus PUT field mismatch) is already tracked by `broken-add-and-update-wiring` and `data-model-mismatch`. No new findings.
