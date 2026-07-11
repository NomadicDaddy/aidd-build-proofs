Import-Module -Name 'PSSQLite' -MaximumVersion 1.99.99 -Force
Import-Module -Name 'Pode' -MaximumVersion 2.99.99 -Force

# pantry data-access layer (defines the Item store functions; registers no routes)
. "$PSScriptRoot/api/_lib/pantry-store.ps1"

# route-registration gate for the file-based api auto-loader (decides which api/*.ps1 become routes)
. "$PSScriptRoot/api/_lib/route-registration.ps1"

function Write-FormattedLog {
	param([string]$tag, [string]$log)
	switch ($tag) {
		'debug' { $icon = '🐞' }
		'database'	{ $icon = '💾' }
		'api' { $icon = '🔗' }
		'informational' { $icon = 'ℹ️' }
		'verbose'	{ $icon = '🔍' }
		'warning'	{ $icon = '⚠️' }
		'error' { $icon = '❌' }
		default { $icon = '✅' }
	}
	$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
	$prefix = '{0} {1} {2} ' -f $timestamp, $tag.PadRight(11), $icon
	Write-PodeHost $prefix -NoNewLine
	$maxLineLength = [int]($Host.UI.RawUI.WindowSize.Width - $prefix.Length - 1)
	$currentPosition = 0
	while ($currentPosition -lt $log.Length) {
		$endPosition = [math]::Min(($log.Length - $currentPosition), $maxLineLength)
		$line = $log.Substring($currentPosition, $endPosition)
		if ($currentPosition -ne 0) {
			Write-PodeHost "$(' ' * $($prefix.Length))$($line)"
		} else {
			Write-PodeHost "$($line)"
		}
		$currentPosition += $line.Length
	}
}
# Note: user-supplied text is NEVER blacklist-sanitized before storage. Every write goes through the
# pantry DAL (api/_lib/pantry-store.ps1), which binds all values as @-parameters, so injection-shaped
# input is stored as data and never executed. Escaping characters here (the removed
# Remove-UnsafeCharacter) was both redundant with parameterization and corrupted legitimate text
# (e.g. O'Brien -> O''Brien, a note with -- -> \-\-), so it was deleted. Store text verbatim.

# Start-PodeServer -Name 'Podex' -ConfigFile '.\podex.psd1' -Threads 5 -ScriptBlock {
Start-PodeServer -Name 'Podex' -Threads 5 -ScriptBlock {

	# get config
	$cfg = (Get-PodeConfig)
	Set-PodeViewEngine -Type Pode

	# ensure the pantry item store exists (idempotent)
	Initialize-PantryStore -DataSource $cfg.Podex.DBFile

	# setup logging
	New-PodeLoggingMethod -File -Path './logs' -Name 'requests' | Enable-PodeRequestLogging
	if ($cfg.Podex.Debug) {
		New-PodeLoggingMethod -Terminal | Enable-PodeErrorLogging
	} else {
		New-PodeLoggingMethod -File -Path './logs' -Name 'errors' | Enable-PodeErrorLogging
	}

	# create appropriate endpoint
	if ($($cfg.PodeCfg.HttpsEnabled) -and $($cfg.PodeCfg.CertThumbprint) -ne '') {
		Add-PodeEndpoint -Address $($cfg.PodeCfg.HttpUrl) -Port $($cfg.PodeCfg.HttpPort) -Protocol Https -CertificateThumbprint $($cfg.PodeCfg.CertThumbprint) -CertificateStoreLocation LocalMachine
	} else {
		Add-PodeEndpoint -Address $($cfg.PodeCfg.HttpUrl) -Port $($cfg.PodeCfg.HttpPort) -Protocol Http
	}

	# Baseline HTTP security response headers (defense-in-depth for XSS, clickjacking, MIME-sniffing).
	# Pode emits none of these by default; this middleware attaches them to EVERY response - HTML views,
	# htmx fragments, JSON API, the CSV download, and static assets alike.
	#   - X-Content-Type-Options: nosniff  (browsers must honour declared content types, no MIME sniffing)
	#   - X-Frame-Options: DENY            (belt-and-braces clickjacking block, paired with CSP frame-ancestors)
	#   - Referrer-Policy: no-referrer      (never leak the current URL to outbound links/requests)
	#   - Content-Security-Policy scoped to first-party assets only:
	#       default-src/script-src/img-src/connect-src 'self' - all JS/CSS/images/htmx XHRs are served from
	#       /public on this same origin, so no third-party or inline SCRIPT is ever allowed (the former inline
	#       <script> in layouts/main.pode was moved to /public/app/pantry.js precisely to keep script-src 'self').
	#       style-src allows 'unsafe-inline' ONLY because htmx injects a small inline <style> for its request
	#       indicators at load (public/js/htmx.js insertIndicatorStyles); inline styles cannot execute code, so
	#       this is a deliberate, low-risk relaxation and scripts remain strictly first-party.
	#       object-src 'none', base-uri 'self', form-action 'self', frame-ancestors 'none' harden the rest.
	Set-PodeSecurityContentTypeOptions
	Set-PodeSecurityFrameOptions -Type Deny
	Set-PodeSecurityReferrerPolicy -Type No-Referrer
	Set-PodeSecurityContentSecurityPolicy `
		-Default 'self' `
		-Scripts 'self' `
		-Style 'self', 'unsafe-inline' `
		-Image 'self' `
		-Connect 'self' `
		-Object 'none' `
		-BaseUri 'self' `
		-FormAction 'self' `
		-FrameAncestor 'none'
	# HSTS is only meaningful over TLS; emit it only when the HTTPS endpoint is active so we never send a
	# Strict-Transport-Security header over plain HTTP (where browsers ignore it and it can mislead).
	if ($cfg.PodeCfg.HttpsEnabled -and $cfg.PodeCfg.CertThumbprint -ne '') {
		Set-PodeSecurityStrictTransportSecurity -Duration 31536000 -IncludeSubDomains
	}

	# static routes
	Add-PodeStaticRoute -Path '/public' -Source './public'

	# front-end routes
	Add-PodeRoute -Path '/' -Method Get, Post -ScriptBlock { Write-PodeViewResponse -Path 'layouts/main' -Data @{ PageName = 'Home'; Title = 'Podex - PowerShell/Pode + htmx Framework for Building Web Applications'; Components = @('about'); } }

	# pantry inventory: server-rendered list grouped by category, sorted by name, with expiry badges.
	# Route runspaces only receive functions Pode discovers by scanning scriptblock ASTs, so the
	# dot-sourced libs from podex.ps1's top scope are not visible here; load them into the request scope.
	Add-PodeRoute -Path '/inventory' -Method Get -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		$items = @(Get-PantryItems)
		$filterHtml = Format-PantryFilterBarHtml -Items $items
		$listHtml = Format-PantryInventoryListHtml -Items $items
		Write-PodeViewResponse -Path 'layouts/main' -Data @{ PageName = 'Inventory'; Title = 'Pantry - Inventory'; Components = @('inventory'); FilterHtml = $filterHtml; ListHtml = $listHtml; }
	}

	# pantry inventory filter: category select + text search over name/notes (case-insensitive, AND).
	# Returns just the #inventory-list fragment so the filter bar swaps only the list via hx-get.
	Add-PodeRoute -Path '/htmx/inventory-filter' -Method Get -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		$category = [string]$WebEvent.Query['category']
		$q = [string]$WebEvent.Query['q']
		$isFiltered = (-not [string]::IsNullOrWhiteSpace($q)) -or (-not [string]::IsNullOrWhiteSpace($category) -and $category -ne 'all')
		$items = @(Select-PantryItems -Items @(Get-PantryItems) -Category $category -Query $q)
		Write-PodeHtmlResponse -Value (Format-PantryInventoryListHtml -Items $items -IsFiltered:$isFiltered)
	}

	# pantry expiring-soon view: items expired or expiring within 7 days, soonest first, with an
	# expired-vs-expiring visual distinction. Server-rendered page; the list and nav count refresh
	# via htmx on the body-level 'itemChanged' event any mutation dispatches.
	Add-PodeRoute -Path '/expiring' -Method Get -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		$expiring = @(Select-PantryExpiringItems -Items @(Get-PantryItems))
		$listHtml = Format-PantryExpiringListHtml -Items $expiring
		Write-PodeViewResponse -Path 'layouts/main' -Data @{ PageName = 'Expiring'; Title = 'Pantry - Expiring soon'; Components = @('expiring'); ListHtml = $listHtml; }
	}

	# expiring-soon list fragment (re-rendered when #expiring-list hears 'itemChanged').
	Add-PodeRoute -Path '/htmx/expiring-list' -Method Get -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		$expiring = @(Select-PantryExpiringItems -Items @(Get-PantryItems))
		Write-PodeHtmlResponse -Value (Format-PantryExpiringListHtml -Items $expiring)
	}

	# nav expiring-soon count badge (self-fetches on load + on every 'itemChanged').
	Add-PodeRoute -Path '/htmx/expiring-count' -Method Get -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		$count = @(Select-PantryExpiringItems -Items @(Get-PantryItems)).Count
		Write-PodeHtmlResponse -Value (Format-PantryExpiringCountHtml -Count $count)
	}

	# pantry low-stock view: items at or below their per-item reorder threshold (quantity <=
	# threshold), name-sorted. Server-rendered page; the list and nav count refresh via htmx on the
	# body-level 'itemChanged' event any mutation dispatches.
	Add-PodeRoute -Path '/lowstock' -Method Get -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		$low = @(Select-PantryLowStockItems -Items @(Get-PantryItems))
		$listHtml = Format-PantryLowStockListHtml -Items $low
		Write-PodeViewResponse -Path 'layouts/main' -Data @{ PageName = 'LowStock'; Title = 'Pantry - Low stock'; Components = @('lowstock'); ListHtml = $listHtml; }
	}

	# low-stock list fragment (re-rendered when #lowstock-list hears 'itemChanged').
	Add-PodeRoute -Path '/htmx/lowstock-list' -Method Get -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		$low = @(Select-PantryLowStockItems -Items @(Get-PantryItems))
		Write-PodeHtmlResponse -Value (Format-PantryLowStockListHtml -Items $low)
	}

	# nav low-stock count badge (self-fetches on load + on every 'itemChanged').
	Add-PodeRoute -Path '/htmx/lowstock-count' -Method Get -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		$count = @(Select-PantryLowStockItems -Items @(Get-PantryItems)).Count
		Write-PodeHtmlResponse -Value (Format-PantryLowStockCountHtml -Count $count)
	}

	# pantry item CRUD (htmx html fragments). Add is a modal form; edit/delete swap a single row.
	Add-PodeRoute -Path '/htmx/item-new' -Method Get -ScriptBlock {
		. './api/_lib/pantry-render.ps1'
		Write-PodeHtmlResponse -Value (Format-PantryItemFormHtml)
	}

	# CSV export: download the full inventory (read through the DAL) as an RFC 4180 CSV attachment.
	# A header row plus one row per current item; fields containing commas, quotes or newlines are
	# quoted/escaped so the file parses correctly. An empty store yields a header-only file (no
	# crash). text/csv + Content-Disposition: attachment so the browser downloads a file.
	Add-PodeRoute -Path '/inventory.csv' -Method Get -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		$csv = ConvertTo-PantryCsv -Items @(Get-PantryItems)
		Add-PodeHeader -Name 'Content-Disposition' -Value 'attachment; filename="pantry-inventory.csv"'
		Write-PodeTextResponse -Value $csv -ContentType 'text/csv'
	}
	Add-PodeRoute -Path '/htmx/item-create' -Method Post -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		$d = $WebEvent.Data
		$errs = @(Test-PantryItemInput -Name $d.name -Quantity $d.quantity -Expiry $d.expiry -Threshold $d.threshold)
		if ($errs.Count -gt 0) {
			# Re-render the add form (with values + errors) back into the modal, not the list.
			# 422 signals a validation failure (never a 500); a body-level htmx:beforeSwap handler
			# still swaps the 422 body so the error fragment renders.
			Add-PodeHeader -Name 'HX-Retarget' -Value '#inventoryModalContent'
			Add-PodeHeader -Name 'HX-Reswap' -Value 'innerHTML'
			Write-PodeHtmlResponse -Value (Format-PantryItemFormHtml -Values $d -Errors $errs) -StatusCode 422
			return
		}
		$threshold = if ([string]::IsNullOrWhiteSpace([string]$d.threshold)) { 1 } else { [double]$d.threshold }
		New-PantryItem -Name $d.name -Category $d.category -Quantity ([double]$d.quantity) -Unit $d.unit -Expiry $d.expiry -Threshold $threshold -Notes $d.notes | Out-Null
		# Close the modal and swap the freshly-rendered list (re-groups a possibly-new category).
		# 'itemChanged' also refreshes the expiring-soon list + nav count wherever they are mounted.
		Add-PodeHeader -Name 'HX-Trigger' -Value '{"closeModal":true,"itemChanged":true}'
		Write-PodeHtmlResponse -Value (Format-PantryInventoryListHtml -Items @(Get-PantryItems))
	}
	Add-PodeRoute -Path '/htmx/item-edit' -Method Get -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		$item = $null
		if ([int]::TryParse([string]$WebEvent.Query['id'], [ref]$null)) { $item = Get-PantryItem -Id ([int]$WebEvent.Query['id']) }
		if (-not $item) { Write-PodeHtmlResponse -Value '' -StatusCode 404; return }
		Write-PodeHtmlResponse -Value (Format-PantryItemEditRowHtml -Item $item)
	}
	Add-PodeRoute -Path '/htmx/item-row' -Method Get -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		$item = $null
		if ([int]::TryParse([string]$WebEvent.Query['id'], [ref]$null)) { $item = Get-PantryItem -Id ([int]$WebEvent.Query['id']) }
		if (-not $item) { Write-PodeHtmlResponse -Value '' -StatusCode 404; return }
		Write-PodeHtmlResponse -Value (Format-PantryItemRowHtml -Item $item)
	}
	Add-PodeRoute -Path '/htmx/item-update' -Method Put -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		$d = $WebEvent.Data
		if (-not [int]::TryParse([string]$d.id, [ref]$null)) { Write-PodeHtmlResponse -Value '' -StatusCode 400; return }
		$id = [int]$d.id
		$errs = @(Test-PantryItemInput -Name $d.name -Quantity $d.quantity -Expiry $d.expiry -Threshold $d.threshold)
		if ($errs.Count -gt 0) {
			# Re-render the edit row (same id) with the submitted values + errors. 422 signals a
			# validation failure (never a 500); the body-level htmx:beforeSwap handler still swaps
			# the 422 body so the error fragment renders in place of the row.
			$pending = [pscustomobject]@{ id = $id; name = $d.name; category = $d.category; quantity = $d.quantity; unit = $d.unit; expiry = $d.expiry; threshold = $d.threshold; notes = $d.notes }
			Write-PodeHtmlResponse -Value (Format-PantryItemEditRowHtml -Item $pending -Errors $errs) -StatusCode 422
			return
		}
		$threshold = if ([string]::IsNullOrWhiteSpace([string]$d.threshold)) { 1 } else { [double]$d.threshold }
		Update-PantryItem -Id $id -Name $d.name -Category $d.category -Quantity ([double]$d.quantity) -Unit $d.unit -Expiry $d.expiry -Threshold $threshold -Notes $d.notes | Out-Null
		# 'itemChanged' refreshes the expiring-soon list + nav count (e.g. an item edited to expire
		# >7 days out drops off the expiring view and the count decrements).
		Add-PodeHeader -Name 'HX-Trigger' -Value 'itemChanged'
		Write-PodeHtmlResponse -Value (Format-PantryItemRowHtml -Item (Get-PantryItem -Id $id))
	}
	# quick-adjust +/-: bump one item's quantity by a signed delta (clamped at 0) and swap just that
	# row - no edit form, no full reload. 'itemChanged' refreshes the low-stock / expiring lists and
	# nav counts, so an adjust that crosses the low-stock threshold updates the nav count.
	Add-PodeRoute -Path '/htmx/item-adjust' -Method Post -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		. './api/_lib/pantry-render.ps1'
		if (-not [int]::TryParse([string]$WebEvent.Query['id'], [ref]$null)) { Write-PodeHtmlResponse -Value '' -StatusCode 400; return }
		$id = [int]$WebEvent.Query['id']
		$delta = 0.0
		[void][double]::TryParse([string]$WebEvent.Query['delta'], [ref]$delta)
		$item = Update-PantryItemQuantity -Id $id -Delta $delta
		if (-not $item) { Write-PodeHtmlResponse -Value '' -StatusCode 404; return }
		Add-PodeHeader -Name 'HX-Trigger' -Value 'itemChanged'
		Write-PodeHtmlResponse -Value (Format-PantryItemRowHtml -Item $item)
	}
	Add-PodeRoute -Path '/htmx/item-delete' -Method Delete -ScriptBlock {
		. './api/_lib/pantry-store.ps1'
		if ([int]::TryParse([string]$WebEvent.Query['id'], [ref]$null)) { Remove-PantryItem -Id ([int]$WebEvent.Query['id']) }
		# Empty body + outerHTML swap removes the row from the list. 'itemChanged' refreshes the
		# expiring-soon list + nav count so a deleted item stops being counted.
		Add-PodeHeader -Name 'HX-Trigger' -Value 'itemChanged'
		Write-PodeHtmlResponse -Value ''
	}

	# htmx routes (html only)
	Add-PodeRoute -Path '/htmx/hello' -Method Get -FilePath './htmx/hello.ps1'

	# file-based api routes (json or html). The gate decides whether each file becomes a route and
	# how: it skips the _lib DAL and — critically — the destructive /debug/* routes (/stop, /clear,
	# /init) whenever Podex.Debug is off, so those are absent under the default configuration.
	foreach ($file in (Get-ChildItem -Path './api' -Filter *.ps1 -Recurse -File)) {
		$relativePath = $file.FullName -replace [regex]::Escape($PWD.Path + '\'), '' -replace '\\', '/'
		$registration = Resolve-ApiRouteRegistration -RelativePath $relativePath -DebugEnabled ([bool]$cfg.Podex.Debug)
		if ($null -eq $registration) { continue }
		Add-PodeRoute -Path $registration.Path -Method $registration.Method -FilePath $file.FullName
	}

	# show routes
	if ($cfg.Podex.Debug) {
		foreach ($route in (Get-PodeRoute | Sort-Object -Unique -Property Path, Method)) {
			# Write-FormattedLog -tag 'routes' -log "$($route.Path.PadRight(30)) -> $($route.Method.PadRight(10)) -> $($logic)"
			Write-FormattedLog -tag 'routes' -log "$($route.Path.PadRight(30)) -> $($route.Method.PadRight(10))"
		}
	}

	# api docs — dev-only. The OpenAPI document (/docs/openapi) and Swagger UI (/docs/swagger) expose
	# the full API surface, so they are gated behind Podex.Debug (default OFF in server.psd1) to match
	# the Debug-gating used for the route dump and the destructive /stop /clear /init routes. Under the
	# default configuration these endpoints are never mounted and return 404.
	if ($cfg.Podex.Debug) {
		Enable-PodeOpenApi -RouteFilter '/api/*' -Path '/docs/openapi'
		Add-PodeOAInfo -Title 'Podex - OpenAPI 3.0' -Version 0.0.1 -Description 'Podex API'
		Enable-PodeOAViewer -Type Swagger -Path '/docs/swagger' -DarkMode -Title 'Podex API' -OpenApiUrl '/docs/openapi'
	}

}
