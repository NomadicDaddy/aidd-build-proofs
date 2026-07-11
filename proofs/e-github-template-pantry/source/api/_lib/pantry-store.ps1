# Pantry data-access layer (DAL).
#
# All persistence for pantry Items lives here so that routes and views never call SQLite
# directly. Storage is a single SQLite table behind these functions; to swap the backend
# (e.g. to a JSON file) only the bodies below change, not the callers.
#
# This file defines functions only - it registers no routes. The route auto-discovery in
# podex.ps1 skips the api/_lib directory. Load it by dot-sourcing:  . ./api/_lib/pantry-store.ps1
#
# Requires the PSSQLite module (Invoke-SqliteQuery, New-SQLiteConnection) to be imported.

# Resolve the SQLite datasource. Explicit -DataSource wins; otherwise fall back to the Pode
# config when running inside the server, then to the on-disk default. Keeping this in one place
# means the storage location is configured once, not scattered across callers.
function Get-PantryDbFile {
	param([string]$DataSource)
	if (-not [string]::IsNullOrWhiteSpace($DataSource)) { return $DataSource }
	if (Get-Command -Name 'Get-PodeConfig' -ErrorAction SilentlyContinue) {
		$cfgDb = (Get-PodeConfig).Podex.DBFile
		if (-not [string]::IsNullOrWhiteSpace($cfgDb)) { return $cfgDb }
	}
	return './podex.db'
}

# Normalize optional text fields: empty/whitespace is stored as NULL rather than ''.
function ConvertTo-PantryNullable {
	param([string]$Value)
	if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
	return $Value
}

# Ensure the pantry items table exists. Idempotent (safe to call on every server boot).
function Initialize-PantryStore {
	param([string]$DataSource)
	$db = Get-PantryDbFile -DataSource $DataSource
	$sqlx = @'
CREATE TABLE IF NOT EXISTS [items] (
	[id] INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	[name] TEXT NOT NULL,
	[category] TEXT,
	[quantity] REAL NOT NULL DEFAULT 0 CHECK ([quantity] >= 0),
	[unit] TEXT,
	[expiry] TEXT,
	[threshold] REAL NOT NULL DEFAULT 1,
	[notes] TEXT,
	[created_at] TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
	[updated_at] TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
);
'@
	Invoke-SqliteQuery -DataSource $db -Query $sqlx
}

# Create one item. Returns the created row (with id + timestamps populated).
function New-PantryItem {
	param(
		[string]$DataSource,
		[Parameter(Mandatory)][string]$Name,
		[string]$Category,
		[double]$Quantity = 0,
		[string]$Unit,
		[string]$Expiry,
		[double]$Threshold = 1,
		[string]$Notes
	)
	$db = Get-PantryDbFile -DataSource $DataSource
	$sqlx = @'
INSERT INTO [items] ([name], [category], [quantity], [unit], [expiry], [threshold], [notes])
VALUES (@name, @category, @quantity, @unit, @expiry, @threshold, @notes);
'@
	$params = @{
		name = $Name
		category = ConvertTo-PantryNullable $Category
		quantity = $Quantity
		unit = ConvertTo-PantryNullable $Unit
		expiry = ConvertTo-PantryNullable $Expiry
		threshold = $Threshold
		notes = ConvertTo-PantryNullable $Notes
	}

	# Insert and read the new id on the SAME connection so last_insert_rowid() is reliable.
	$conn = New-SQLiteConnection -DataSource $db
	try {
		Invoke-SqliteQuery -SQLiteConnection $conn -Query $sqlx -SqlParameters $params
		$idRow = Invoke-SqliteQuery -SQLiteConnection $conn -Query 'SELECT last_insert_rowid() AS [id];' -As PSObject
		$newId = [int]$idRow.id
	} finally {
		$conn.Close()
	}

	return (Get-PantryItem -DataSource $db -Id $newId)
}

# Read one item by id. Returns $null when not found.
function Get-PantryItem {
	param(
		[string]$DataSource,
		[Parameter(Mandatory)][int]$Id
	)
	$db = Get-PantryDbFile -DataSource $DataSource
	return (Invoke-SqliteQuery -DataSource $db -Query 'SELECT * FROM [items] WHERE [id] = @id;' -SqlParameters @{ id = $Id } -As PSObject)
}

# List all items, sorted by name (case-insensitive) to match the inventory view's ordering.
function Get-PantryItems {
	param([string]$DataSource)
	$db = Get-PantryDbFile -DataSource $DataSource
	return (Invoke-SqliteQuery -DataSource $db -Query 'SELECT * FROM [items] ORDER BY [name] COLLATE NOCASE ASC;' -As PSObject)
}

# Filter a set of items by category and a free-text search term. Pure function (no storage) shared
# by the inventory filter route so the filter rules live in one testable place.
#   -Category : match items whose display category equals this value (blank category -> 'Uncategorized').
#               '' or 'all' means no category filter.
#   -Query    : case-insensitive substring match over name OR notes. Blank means no text filter.
# Both filters apply together (AND). Wildcard metacharacters in the query are matched literally.
function Select-PantryItems {
	param(
		$Items,
		[string]$Category,
		[string]$Query
	)
	$result = @($Items)

	if (-not [string]::IsNullOrWhiteSpace($Category) -and $Category -ne 'all') {
		$result = @($result | Where-Object {
				$itemCat = if ([string]::IsNullOrWhiteSpace([string]$_.category)) { 'Uncategorized' } else { [string]$_.category }
				$itemCat -eq $Category
			})
	}

	if (-not [string]::IsNullOrWhiteSpace($Query)) {
		$pattern = '*' + [System.Management.Automation.WildcardPattern]::Escape($Query.Trim()) + '*'
		$result = @($result | Where-Object {
				([string]$_.name -like $pattern) -or ([string]$_.notes -like $pattern)
			})
	}

	return $result
}

# Update one item by id. Bumps updated_at. Returns the updated row.
function Update-PantryItem {
	param(
		[string]$DataSource,
		[Parameter(Mandatory)][int]$Id,
		[Parameter(Mandatory)][string]$Name,
		[string]$Category,
		[double]$Quantity = 0,
		[string]$Unit,
		[string]$Expiry,
		[double]$Threshold = 1,
		[string]$Notes
	)
	$db = Get-PantryDbFile -DataSource $DataSource
	$sqlx = @'
UPDATE [items]
SET [name] = @name,
	[category] = @category,
	[quantity] = @quantity,
	[unit] = @unit,
	[expiry] = @expiry,
	[threshold] = @threshold,
	[notes] = @notes,
	[updated_at] = strftime('%Y-%m-%d %H:%M:%S', 'now')
WHERE [id] = @id;
'@
	$params = @{
		id = $Id
		name = $Name
		category = ConvertTo-PantryNullable $Category
		quantity = $Quantity
		unit = ConvertTo-PantryNullable $Unit
		expiry = ConvertTo-PantryNullable $Expiry
		threshold = $Threshold
		notes = ConvertTo-PantryNullable $Notes
	}
	Invoke-SqliteQuery -DataSource $db -Query $sqlx -SqlParameters $params
	return (Get-PantryItem -DataSource $db -Id $Id)
}

# Adjust one item's quantity by a signed delta, clamping the result at 0 (a quantity can never go
# negative). Only the quantity + updated_at columns change; every other field is preserved. Returns
# the updated row, or $null when the id does not exist. Used by the quick-adjust +/- route so the
# clamp-at-zero rule lives with the storage layer rather than in the route.
function Update-PantryItemQuantity {
	param(
		[string]$DataSource,
		[Parameter(Mandatory)][int]$Id,
		[Parameter(Mandatory)][double]$Delta
	)
	$db = Get-PantryDbFile -DataSource $DataSource
	$item = Get-PantryItem -DataSource $db -Id $Id
	if (-not $item) { return $null }
	$current = 0.0
	[void][double]::TryParse([string]$item.quantity, [ref]$current)
	$new = $current + $Delta
	if ($new -lt 0) { $new = 0 }
	$sqlx = @'
UPDATE [items]
SET [quantity] = @quantity,
	[updated_at] = strftime('%Y-%m-%d %H:%M:%S', 'now')
WHERE [id] = @id;
'@
	Invoke-SqliteQuery -DataSource $db -Query $sqlx -SqlParameters @{ id = $Id; quantity = $new }
	return (Get-PantryItem -DataSource $db -Id $Id)
}

# Classify an item's expiry relative to a reference date (default: today).
# Returns:
#   'none'     - no expiry date recorded (or unparseable)
#   'expired'  - expiry is before the reference date
#   'expiring' - expiry is within the next 7 days (inclusive of today)
#   'ok'       - expiry is more than 7 days out
# Pure function (no storage) used by the inventory view to render expiry badges.
function Get-PantryExpiryState {
	param(
		[string]$Expiry,
		[datetime]$AsOf = (Get-Date)
	)
	if ([string]::IsNullOrWhiteSpace($Expiry)) { return 'none' }
	$parsed = [datetime]::MinValue
	if (-not [datetime]::TryParse($Expiry, [ref]$parsed)) { return 'none' }
	$days = ($parsed.Date - $AsOf.Date).Days
	if ($days -lt 0) { return 'expired' }
	if ($days -le 7) { return 'expiring' }
	return 'ok'
}

# Select the items that belong on the expiring-soon view: those whose expiry is already past OR
# within the next 7 days (inclusive of today). Items with no expiry, an unparseable expiry, or an
# expiry more than 7 days out are excluded. Results are ordered soonest-expiry first, so already
# expired items (earliest dates) sort ahead of items merely expiring soon. Pure function (no
# storage) shared by the expiring-soon page, its htmx list fragment, and the nav count so the same
# rule lives in one testable place. Reuses Get-PantryExpiryState for the in/out decision.
function Select-PantryExpiringItems {
	param(
		$Items,
		[datetime]$AsOf = (Get-Date)
	)
	$result = @(@($Items) | Where-Object {
			$state = Get-PantryExpiryState -Expiry ([string]$_.expiry) -AsOf $AsOf
			$state -eq 'expired' -or $state -eq 'expiring'
		})
	return @($result | Sort-Object -Property @{ Expression = {
				$d = [datetime]::MinValue
				[void][datetime]::TryParse([string]$_.expiry, [ref]$d)
				$d
			}
		})
}

# Select the items that belong on the low-stock view: those whose quantity is at or below their
# per-item reorder threshold (quantity <= threshold). Threshold defaults to 1 when it is missing,
# blank, or unparseable (matching the item model's default). Results are ordered by name
# (case-insensitive) to match the inventory view. Pure function (no storage) shared by the low-stock
# page, its htmx list fragment, and the nav count so the same rule lives in one testable place.
function Select-PantryLowStockItems {
	param($Items)
	$result = @(@($Items) | Where-Object {
			$q = 0.0
			[void][double]::TryParse([string]$_.quantity, [ref]$q)
			$t = 1.0
			if (-not [string]::IsNullOrWhiteSpace([string]$_.threshold)) {
				if (-not [double]::TryParse([string]$_.threshold, [ref]$t)) { $t = 1.0 }
			}
			$q -le $t
		})
	return @($result | Sort-Object -Property @{ Expression = { [string]$_.name } })
}

# Validate raw (string) item input as submitted by a form. Returns an array of human-readable
# error messages ($@() when the input is valid). Pure function used by the CRUD routes so add and
# edit share one rule set: name required, quantity required and >= 0, optional threshold a
# non-negative integer, optional expiry a parseable date.
function Test-PantryItemInput {
	param(
		[string]$Name,
		[string]$Quantity,
		[string]$Expiry,
		[string]$Threshold
	)
	$errors = @()
	if ([string]::IsNullOrWhiteSpace($Name)) { $errors += 'Name is required.' }

	$q = 0.0
	if ([string]::IsNullOrWhiteSpace($Quantity)) {
		$errors += 'Quantity is required.'
	} elseif (-not [double]::TryParse($Quantity, [ref]$q)) {
		$errors += 'Quantity must be a number.'
	} elseif ($q -lt 0) {
		$errors += 'Quantity must be zero or greater.'
	}

	if (-not [string]::IsNullOrWhiteSpace($Threshold)) {
		$t = 0
		if (-not [int]::TryParse($Threshold, [ref]$t)) {
			$errors += 'Threshold must be a whole number.'
		} elseif ($t -lt 0) {
			$errors += 'Threshold must be zero or greater.'
		}
	}

	if (-not [string]::IsNullOrWhiteSpace($Expiry)) {
		$d = [datetime]::MinValue
		if (-not [datetime]::TryParse($Expiry, [ref]$d)) { $errors += 'Expiry must be a valid date.' }
	}

	return $errors
}

# Serialize a set of items to RFC 4180 CSV text: a header row followed by one row per item, in the
# order given. Column order matches the item form fields (name, category, quantity, unit, expiry,
# threshold, notes). Any field containing a comma, double quote, CR or LF is wrapped in double
# quotes with embedded quotes doubled; other fields are emitted verbatim. Rows are separated by
# CRLF. An empty item set yields a header-only document (no crash). Pure function (no storage) so
# the export route reads the current rows through the DAL (Get-PantryItems) and passes them here.
function ConvertTo-PantryCsv {
	param($Items)
	$columns = @('name', 'category', 'quantity', 'unit', 'expiry', 'threshold', 'notes')

	$escape = {
		param($Value)
		$s = [string]$Value
		if ($s -match '[",\r\n]') { return '"' + ($s -replace '"', '""') + '"' }
		return $s
	}

	$lines = @()
	$lines += (($columns | ForEach-Object { & $escape $_ }) -join ',')
	foreach ($item in @($Items)) {
		$cells = foreach ($col in $columns) { & $escape $item.$col }
		$lines += ($cells -join ',')
	}
	return ($lines -join "`r`n")
}

# Delete one item by id.
function Remove-PantryItem {
	param(
		[string]$DataSource,
		[Parameter(Mandatory)][int]$Id
	)
	$db = Get-PantryDbFile -DataSource $DataSource
	Invoke-SqliteQuery -DataSource $db -Query 'DELETE FROM [items] WHERE [id] = @id;' -SqlParameters @{ id = $Id }
}
