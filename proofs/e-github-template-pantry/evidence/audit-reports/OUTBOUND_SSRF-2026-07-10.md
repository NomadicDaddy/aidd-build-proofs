<!-- aidd:audit-report-meta {"generatedAt":"2026-07-10T14:45:28.686Z","gitHead":"44abbe33f3fd26915bf064da15141f9c7d4b86a1","version":1} -->

# OUTBOUND_SSRF Audit Report - 2026-07-10

**Verdict: N/A.** grep for outbound HTTP (`Invoke-WebRequest|Invoke-RestMethod|System.Net|HttpClient|fetch(`) over *.ps1 returns nothing. Only local SQLite egress. No configurable outbound URL to falsify.
