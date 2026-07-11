#requires -Version 7.0
<#
.SYNOPSIS
	Seed the pantry with ~20 realistic sample items so every view has content.

.DESCRIPTION
	Loads a curated set of ~20 pantry items spanning multiple categories (Oils, Grains, Canned,
	Baking, Spices, Dairy, Condiments, Snacks). The set deliberately includes:
	  * several items at or below their reorder threshold  -> populates the Low stock view
	  * several items expiring within the next 7 days       -> populates the Expiring soon view
	  * at least one already-expired item                   -> exercises the expired badge

	Items are written EXCLUSIVELY through the data-access layer (New-PantryItem in
	api/_lib/pantry-store.ps1) so validation, NULL-normalization, and timestamps behave exactly as
	they do for a form submission. The script never touches SQLite directly for inserts.

	Expiry dates are computed relative to "today" at run time (offsets in days), so the low-stock /
	expiring buckets stay correct whenever the script is run.

.PARAMETER DataSource
	Path to the SQLite database file. Defaults to the same file the server uses (./podex.db via the
	DAL's Get-PantryDbFile resolver).

.PARAMETER Append
	Append the sample items to whatever is already in the database. By DEFAULT the script is
	idempotent: it RESETS the items table (deletes existing rows) before inserting, so re-running it
	always yields the same ~20 items and never accumulates duplicates. Pass -Append to keep existing
	rows and add the sample set on top instead.

.EXAMPLE
	pwsh ./scripts/seed.ps1
	Reset the items table and load the sample set (idempotent - safe to re-run).

.EXAMPLE
	pwsh ./scripts/seed.ps1 -Append
	Add the sample set on top of existing data without deleting anything.

.NOTES
	IDEMPOTENCY: default mode RESETS (clears the items table, then inserts). This is a destructive
	reset of the items table by design - do not run against data you care about. Use -Append to
	preserve existing rows.
#>
[CmdletBinding()]
param(
	[string]$DataSource,
	[switch]$Append
)

$ErrorActionPreference = 'Stop'

# Load the same PSSQLite module the server uses, then the pantry DAL. Inserts go exclusively
# through the DAL functions defined here (New-PantryItem) - never raw SQL.
Import-Module -Name 'PSSQLite' -MaximumVersion 1.99.99 -Force
. "$PSScriptRoot/../api/_lib/pantry-store.ps1"

# Resolve the target DB the same way every DAL caller does, and make sure the schema exists.
$db = Get-PantryDbFile -DataSource $DataSource
Initialize-PantryStore -DataSource $db

# Helper: format a date offset (in days from today) as the YYYY-MM-DD string the model stores.
# $null offset -> no expiry.
function Get-SeedExpiry {
	param([Nullable[int]]$OffsetDays)
	if ($null -eq $OffsetDays) { return $null }
	return (Get-Date).Date.AddDays($OffsetDays).ToString('yyyy-MM-dd')
}

# The sample set. ExpiryOffset is days from today (negative = already expired, null = no expiry).
# Low-stock rows have Quantity <= Threshold; expiring rows have a small positive offset.
$seedItems = @(
	# Oils
	@{ Name = 'Olive oil'; Category = 'Oils'; Quantity = 2; Unit = 'bottles'; Threshold = 1; ExpiryOffset = 300; Notes = 'Extra virgin' }
	@{ Name = 'Vegetable oil'; Category = 'Oils'; Quantity = 1; Unit = 'bottle'; Threshold = 1; ExpiryOffset = 200; Notes = $null } # low stock

	# Grains
	@{ Name = 'White rice'; Category = 'Grains'; Quantity = 3; Unit = 'kg'; Threshold = 1; ExpiryOffset = 400; Notes = $null }
	@{ Name = 'Spaghetti'; Category = 'Grains'; Quantity = 5; Unit = 'boxes'; Threshold = 2; ExpiryOffset = $null; Notes = $null }
	@{ Name = 'Rolled oats'; Category = 'Grains'; Quantity = 1; Unit = 'bag'; Threshold = 2; ExpiryOffset = 5; Notes = 'For porridge' } # low + expiring

	# Canned
	@{ Name = 'Chopped tomatoes'; Category = 'Canned'; Quantity = 6; Unit = 'cans'; Threshold = 3; ExpiryOffset = 500; Notes = $null }
	@{ Name = 'Black beans'; Category = 'Canned'; Quantity = 2; Unit = 'cans'; Threshold = 3; ExpiryOffset = 450; Notes = $null } # low stock
	@{ Name = 'Tuna'; Category = 'Canned'; Quantity = 4; Unit = 'cans'; Threshold = 2; ExpiryOffset = 180; Notes = $null }
	@{ Name = 'Coconut milk'; Category = 'Canned'; Quantity = 0; Unit = 'cans'; Threshold = 1; ExpiryOffset = 220; Notes = 'Out of stock' } # low (out)

	# Baking
	@{ Name = 'Plain flour'; Category = 'Baking'; Quantity = 2; Unit = 'kg'; Threshold = 1; ExpiryOffset = -3; Notes = 'Check for weevils' } # EXPIRED
	@{ Name = 'Caster sugar'; Category = 'Baking'; Quantity = 1; Unit = 'kg'; Threshold = 1; ExpiryOffset = $null; Notes = $null } # low stock
	@{ Name = 'Baking powder'; Category = 'Baking'; Quantity = 1; Unit = 'tin'; Threshold = 1; ExpiryOffset = 6; Notes = $null } # low + expiring

	# Spices
	@{ Name = 'Sea salt'; Category = 'Spices'; Quantity = 1; Unit = 'box'; Threshold = 1; ExpiryOffset = $null; Notes = $null } # low stock
	@{ Name = 'Black pepper'; Category = 'Spices'; Quantity = 2; Unit = 'jars'; Threshold = 1; ExpiryOffset = $null; Notes = 'Whole peppercorns' }

	# Dairy
	@{ Name = 'Whole milk'; Category = 'Dairy'; Quantity = 2; Unit = 'cartons'; Threshold = 1; ExpiryOffset = 3; Notes = $null } # expiring
	@{ Name = 'Butter'; Category = 'Dairy'; Quantity = 1; Unit = 'pack'; Threshold = 1; ExpiryOffset = 2; Notes = $null } # low + expiring
	@{ Name = 'Eggs'; Category = 'Dairy'; Quantity = 12; Unit = 'units'; Threshold = 6; ExpiryOffset = 10; Notes = 'Free range' }

	# Condiments
	@{ Name = 'Ketchup'; Category = 'Condiments'; Quantity = 1; Unit = 'bottle'; Threshold = 1; ExpiryOffset = 120; Notes = $null } # low stock
	@{ Name = 'Soy sauce'; Category = 'Condiments'; Quantity = 3; Unit = 'bottles'; Threshold = 1; ExpiryOffset = 365; Notes = $null }
	@{ Name = 'Honey'; Category = 'Condiments'; Quantity = 2; Unit = 'jars'; Threshold = 1; ExpiryOffset = $null; Notes = $null }

	# Snacks
	@{ Name = 'Water crackers'; Category = 'Snacks'; Quantity = 2; Unit = 'packs'; Threshold = 1; ExpiryOffset = -1; Notes = $null } # EXPIRED
)

# DEFAULT (idempotent) mode resets the items table first so re-runs never accumulate duplicates.
# -Append preserves existing rows. Reset is a plain DELETE (keeps the schema + AUTOINCREMENT table).
if (-not $Append) {
	Write-Output "Resetting items table (default idempotent mode; use -Append to keep existing rows)..."
	Invoke-SqliteQuery -DataSource $db -Query 'DELETE FROM [items];' | Out-Null
} else {
	Write-Output 'Appending sample items to existing data (-Append)...'
}

$created = 0
foreach ($it in $seedItems) {
	$expiry = Get-SeedExpiry -OffsetDays $it.ExpiryOffset
	$params = @{
		DataSource = $db
		Name = $it.Name
		Category = $it.Category
		Quantity = [double]$it.Quantity
		Unit = $it.Unit
		Threshold = [double]$it.Threshold
	}
	if ($null -ne $expiry) { $params.Expiry = $expiry }
	if ($null -ne $it.Notes) { $params.Notes = $it.Notes }
	New-PantryItem @params | Out-Null
	$created++
}

# Report a quick summary so the operator can see the low-stock / expiring buckets are populated.
$all = Get-PantryItems -DataSource $db
$low = Select-PantryLowStockItems -Items $all
$expiring = Select-PantryExpiringItems -Items $all
$expired = @($expiring | Where-Object { (Get-PantryExpiryState -Expiry ([string]$_.expiry)) -eq 'expired' })
$categories = @($all | ForEach-Object { if ([string]::IsNullOrWhiteSpace([string]$_.category)) { 'Uncategorized' } else { [string]$_.category } } | Sort-Object -Unique)

Write-Output ''
Write-Output "Seed complete: inserted $created items into $db"
Write-Output ("  Total items now:   {0}" -f @($all).Count)
Write-Output ("  Categories:        {0} ({1})" -f $categories.Count, ($categories -join ', '))
Write-Output ("  Low stock:         {0}" -f @($low).Count)
Write-Output ("  Expiring (<=7d):   {0} (of which already expired: {1})" -f @($expiring).Count, @($expired).Count)

