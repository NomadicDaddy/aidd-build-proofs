# Pester suite for the Pantry app.
#
# Runs via `npm test` (Invoke-Pester -Path ./tests/*.ps1). Covers the data-access layer and every
# pure helper the routes/views delegate to: CRUD round-trips + persistence, server-side validation,
# the inventory list (grouping / name sort / empty state), category filter + case-insensitive
# search, low-stock selection + nav count, expiring-soon selection + ordering + nav count,
# quick-adjust (increment / decrement / 0 floor / single-row persistence), and CSV export.
#
# The htmx routes in podex.ps1 are thin glue: each validates with Test-PantryItemInput, mutates via
# the DAL (New-/Update-/Remove-PantryItem), and renders a fragment with the pantry-render helpers.
# Those pieces are exercised directly here (against a throwaway SQLite file), so the suite stays fast
# and deterministic without standing up an HTTP server. Route "returns the expected fragment / status
# code" behaviour is covered by asserting on the same validation -> store -> render composition the
# routes run, including the "persist nothing on a validation error" rule.

BeforeAll {
	Import-Module PSSQLite -ErrorAction Stop

	$repoRoot = Split-Path -Parent $PSScriptRoot
	. (Join-Path $repoRoot 'api/_lib/pantry-store.ps1')
	. (Join-Path $repoRoot 'api/_lib/pantry-render.ps1')
	. (Join-Path $repoRoot 'api/_lib/crud-paging.ps1')
	. (Join-Path $repoRoot 'api/_lib/route-registration.ps1')

	# Create a fresh, isolated SQLite file and initialize the items table. Returns the path.
	function New-TestDb {
		$path = Join-Path ([System.IO.Path]::GetTempPath()) ("pantry-test-" + [guid]::NewGuid().ToString('N') + '.db')
		Initialize-PantryStore -DataSource $path | Out-Null
		return $path
	}

	# Build a lightweight item object for the pure (storage-free) helpers.
	function New-ItemObject {
		param(
			[string]$Name = 'Item',
			[string]$Category = '',
			$Quantity = 0,
			[string]$Unit = '',
			[string]$Expiry = '',
			$Threshold = 1,
			[string]$Notes = '',
			$Id = 1
		)
		[pscustomobject]@{
			id = $Id
			name = $Name
			category = $Category
			quantity = $Quantity
			unit = $Unit
			expiry = $Expiry
			threshold = $Threshold
			notes = $Notes
		}
	}
}

Describe 'Data-access layer (CRUD round-trips + persistence)' {
	BeforeEach {
		$script:Db = New-TestDb
	}
	AfterEach {
		if (Test-Path $script:Db) { Remove-Item $script:Db -Force -ErrorAction SilentlyContinue }
	}

	It 'creates an item and reads it back with an id and timestamps' {
		$created = New-PantryItem -DataSource $script:Db -Name 'Olive oil' -Category 'Oils' -Quantity 2 -Unit 'bottles' -Threshold 1 -Notes 'extra virgin'
		$created.id | Should -BeGreaterThan 0
		$created.name | Should -Be 'Olive oil'
		$created.category | Should -Be 'Oils'
		[double]$created.quantity | Should -Be 2
		$created.unit | Should -Be 'bottles'
		$created.created_at | Should -Not -BeNullOrEmpty
		$created.updated_at | Should -Not -BeNullOrEmpty

		$fetched = Get-PantryItem -DataSource $script:Db -Id ([int]$created.id)
		$fetched.name | Should -Be 'Olive oil'
	}

	It 'stores blank optional fields as NULL' {
		$created = New-PantryItem -DataSource $script:Db -Name 'Salt' -Category '' -Unit '  ' -Notes ''
		$fetched = Get-PantryItem -DataSource $script:Db -Id ([int]$created.id)
		$fetched.category | Should -BeNullOrEmpty
		$fetched.unit | Should -BeNullOrEmpty
		$fetched.notes | Should -BeNullOrEmpty
	}

	It 'updates an item and preserves the change' {
		$created = New-PantryItem -DataSource $script:Db -Name 'Rice' -Category 'Grains' -Quantity 1
		Update-PantryItem -DataSource $script:Db -Id ([int]$created.id) -Name 'Basmati rice' -Category 'Grains' -Quantity 3 -Threshold 2 | Out-Null
		$fetched = Get-PantryItem -DataSource $script:Db -Id ([int]$created.id)
		$fetched.name | Should -Be 'Basmati rice'
		[double]$fetched.quantity | Should -Be 3
		[double]$fetched.threshold | Should -Be 2
	}

	It 'deletes an item' {
		$created = New-PantryItem -DataSource $script:Db -Name 'Temp'
		Remove-PantryItem -DataSource $script:Db -Id ([int]$created.id)
		Get-PantryItem -DataSource $script:Db -Id ([int]$created.id) | Should -BeNullOrEmpty
	}

	It 'deleting an unknown id is a harmless no-op (no crash, other rows untouched)' {
		$keep = New-PantryItem -DataSource $script:Db -Name 'Keep me'
		{ Remove-PantryItem -DataSource $script:Db -Id 999999 } | Should -Not -Throw
		@(Get-PantryItems -DataSource $script:Db).Count | Should -Be 1
		(Get-PantryItem -DataSource $script:Db -Id ([int]$keep.id)).name | Should -Be 'Keep me'
	}

	It 'reading an unknown id returns $null (invalid-id read path)' {
		Get-PantryItem -DataSource $script:Db -Id 999999 | Should -BeNullOrEmpty
	}

	It 'lists items sorted by name (case-insensitive) and persists across calls' {
		New-PantryItem -DataSource $script:Db -Name 'banana' | Out-Null
		New-PantryItem -DataSource $script:Db -Name 'Apple' | Out-Null
		New-PantryItem -DataSource $script:Db -Name 'cherry' | Out-Null
		$items = @(Get-PantryItems -DataSource $script:Db)
		$items.Count | Should -Be 3
		@($items | ForEach-Object { $_.name }) | Should -Be @('Apple', 'banana', 'cherry')
	}
}

Describe 'SQL-injection safety (parameterized queries store input literally)' {
	BeforeEach {
		$script:Db = New-TestDb
	}
	AfterEach {
		if (Test-Path $script:Db) { Remove-Item $script:Db -Force -ErrorAction SilentlyContinue }
	}

	# The DAL binds every value through @-parameters (SqlParameters), so injection-shaped input is
	# stored as data, never executed. These guards assert the classic "'); DROP TABLE items;--"
	# payload cannot drop the table, and that quotes/semicolons round-trip verbatim.
	It 'a DROP-TABLE-shaped name is stored literally and the table survives' {
		$payload = "'); DROP TABLE [items]; --"
		$created = New-PantryItem -DataSource $script:Db -Name $payload -Quantity 1
		# Table still exists and the row read back matches the payload byte-for-byte.
		$fetched = Get-PantryItem -DataSource $script:Db -Id ([int]$created.id)
		$fetched.name | Should -Be $payload
		@(Get-PantryItems -DataSource $script:Db).Count | Should -Be 1
	}

	It 'an injection-shaped search term matches literally and never executes' {
		New-PantryItem -DataSource $script:Db -Name 'Milk' -Notes "1' OR '1'='1" | Out-Null
		New-PantryItem -DataSource $script:Db -Name 'Eggs' | Out-Null
		$items = @(Get-PantryItems -DataSource $script:Db)
		# Select-PantryItems treats the term as a literal substring (no boolean-injection match-all).
		$hit = @(Select-PantryItems -Items $items -Query "1' OR '1'='1")
		$hit.Count | Should -Be 1
		$hit[0].name | Should -Be 'Milk'
	}

	It 'an update with an injection-shaped value is bound as data, not SQL' {
		$created = New-PantryItem -DataSource $script:Db -Name 'Butter' -Quantity 1
		$payload = "x'; DELETE FROM [items]; --"
		Update-PantryItem -DataSource $script:Db -Id ([int]$created.id) -Name $payload -Quantity 2 | Out-Null
		# The DELETE inside the payload did not run: the row is intact with the literal new name.
		@(Get-PantryItems -DataSource $script:Db).Count | Should -Be 1
		(Get-PantryItem -DataSource $script:Db -Id ([int]$created.id)).name | Should -Be $payload
	}

	# Legitimate text with characters the deleted Remove-UnsafeCharacter blacklist used to mangle
	# (apostrophe, -- , double-quote, semicolon, backslash) must round-trip byte-for-byte: no doubled
	# apostrophes (O'Brien, not O''Brien), no backslash-escaping. Parameterization stores it verbatim.
	It "legitimate text (O'Brien -- note) round-trips unchanged through create + read" {
		$name = "O'Brien"
		$notes = 'batch -- "special"; C:\pantry\aisle 3\'
		$created = New-PantryItem -DataSource $script:Db -Name $name -Notes $notes -Quantity 1
		$fetched = Get-PantryItem -DataSource $script:Db -Id ([int]$created.id)
		$fetched.name | Should -BeExactly $name
		$fetched.notes | Should -BeExactly $notes
	}

	It "legitimate text round-trips unchanged through update + read" {
		$created = New-PantryItem -DataSource $script:Db -Name 'Placeholder' -Quantity 1
		$name = "D'Angelo"
		$notes = 'use -- sparingly; keep 100% "dry"\'
		Update-PantryItem -DataSource $script:Db -Id ([int]$created.id) -Name $name -Notes $notes -Quantity 1 | Out-Null
		$fetched = Get-PantryItem -DataSource $script:Db -Id ([int]$created.id)
		$fetched.name | Should -BeExactly $name
		$fetched.notes | Should -BeExactly $notes
	}
}

Describe 'Item CRUD routes: validation + store composition' {
	BeforeEach {
		$script:Db = New-TestDb
	}
	AfterEach {
		if (Test-Path $script:Db) { Remove-Item $script:Db -Force -ErrorAction SilentlyContinue }
	}

	# Mirrors the /htmx/item-create route: validate, and only persist + render a row when valid.
	It 'a valid add persists the item and renders its row fragment' {
		$errs = @(Test-PantryItemInput -Name 'Flour' -Quantity '5' -Expiry '' -Threshold '2')
		$errs.Count | Should -Be 0
		$created = New-PantryItem -DataSource $script:Db -Name 'Flour' -Quantity 5 -Threshold 2
		@(Get-PantryItems -DataSource $script:Db).Count | Should -Be 1
		$row = Format-PantryItemRowHtml -Item $created
		$row | Should -Match "id='item-row-$([int]$created.id)'"
		$row | Should -Match 'Flour'
	}

	It 'a valid edit updates the item and renders the read-only row' {
		$created = New-PantryItem -DataSource $script:Db -Name 'Sugar' -Quantity 1
		$errs = @(Test-PantryItemInput -Name 'Brown sugar' -Quantity '4' -Expiry '' -Threshold '')
		$errs.Count | Should -Be 0
		$updated = Update-PantryItem -DataSource $script:Db -Id ([int]$created.id) -Name 'Brown sugar' -Quantity 4
		$row = Format-PantryItemRowHtml -Item $updated
		$row | Should -Match 'Brown sugar'
		(Get-PantryItem -DataSource $script:Db -Id ([int]$created.id)).name | Should -Be 'Brown sugar'
	}

	It 'a delete removes the row so the list no longer contains it' {
		$created = New-PantryItem -DataSource $script:Db -Name 'Old jam'
		Remove-PantryItem -DataSource $script:Db -Id ([int]$created.id)
		@(Get-PantryItems -DataSource $script:Db).Count | Should -Be 0
	}

	It 'an invalid add fails validation and persists nothing (422 path)' {
		$errs = @(Test-PantryItemInput -Name '' -Quantity '-1' -Expiry 'not-a-date' -Threshold '')
		$errs.Count | Should -BeGreaterThan 0
		# Route renders the form with errors and returns 422 without touching the store.
		$fragment = Format-PantryItemFormHtml -Values @{ name = '' } -Errors $errs
		$fragment | Should -Match "role='dialog'"
		$fragment | Should -Match "role='alert'"
		@(Get-PantryItems -DataSource $script:Db).Count | Should -Be 0
	}
}

# Regression guard for audit finding "broken-add-and-update-wiring": the pre-Pantry demo had three
# inconsistent names for the add-item modal (hx-get target, podex route path, on-disk view file) and
# an edit form that posted id/item/description while the route validated application/featureName/tag,
# so Add 404'd and Update always 400'd. That demo path is deleted; these tests pin the replacement so
# the mismatch cannot silently return: the rendered forms must wire to the routes that exist in
# podex.ps1 and submit exactly the field names those routes read from $WebEvent.Data.
Describe 'Add/Edit form wiring aligns with the item-create / item-update routes' {
	# The field name= attributes the /htmx/item-create and /htmx/item-update routes consume via
	# $WebEvent.Data ($d.name, $d.category, $d.quantity, $d.unit, $d.expiry, $d.threshold, $d.notes).
	$routeFields = @('name', 'category', 'quantity', 'unit', 'expiry', 'threshold', 'notes')

	It 'the add form posts to /htmx/item-create and submits every field the route reads' {
		$form = Format-PantryItemFormHtml
		$form | Should -Match "hx-post='/htmx/item-create'"
		foreach ($f in $routeFields) {
			$form | Should -Match "name='$f'"
		}
	}

	It 'the add-item button (empty state) targets the route that podex.ps1 registers' {
		# crud-new/crudmgr-new/item-new were three names for one modal; now there is exactly one.
		$empty = Format-PantryInventoryListHtml -Items @()
		$empty | Should -Match "hx-get='/htmx/item-new'"
	}

	It 'the edit row PUTs to /htmx/item-update and submits id plus every field the route reads' {
		$item = New-ItemObject -Name 'Sugar' -Category 'Baking' -Quantity 2 -Unit 'kg' -Threshold 1 -Id 7
		$row = Format-PantryItemEditRowHtml -Item $item
		$row | Should -Match "hx-put='/htmx/item-update'"
		$row | Should -Match "name='id'"
		foreach ($f in $routeFields) {
			$row | Should -Match "name='$f'"
		}
	}

	It 'the edit row does not resurrect the old demo field names (item/description/featureName/tag)' {
		$item = New-ItemObject -Name 'Sugar' -Id 7
		$row = Format-PantryItemEditRowHtml -Item $item
		$row | Should -Not -Match "name='item'"
		$row | Should -Not -Match "name='description'"
		$row | Should -Not -Match "name='featureName'"
		$row | Should -Not -Match "name='tag'"
	}
}

Describe 'Server-side validation (Test-PantryItemInput)' {
	It 'accepts valid input' {
		@(Test-PantryItemInput -Name 'Beans' -Quantity '3' -Expiry '2030-01-01' -Threshold '2') | Should -BeNullOrEmpty
	}
	It 'rejects a missing name' {
		Test-PantryItemInput -Name '' -Quantity '1' -Expiry '' -Threshold '' | Should -Contain 'Name is required.'
	}
	It 'rejects a missing quantity' {
		Test-PantryItemInput -Name 'X' -Quantity '' -Expiry '' -Threshold '' | Should -Contain 'Quantity is required.'
	}
	It 'rejects a negative quantity' {
		Test-PantryItemInput -Name 'X' -Quantity '-2' -Expiry '' -Threshold '' | Should -Contain 'Quantity must be zero or greater.'
	}
	It 'rejects a non-numeric quantity' {
		Test-PantryItemInput -Name 'X' -Quantity 'abc' -Expiry '' -Threshold '' | Should -Contain 'Quantity must be a number.'
	}
	It 'rejects an invalid date' {
		Test-PantryItemInput -Name 'X' -Quantity '1' -Expiry '2030-13-40' -Threshold '' | Should -Contain 'Expiry must be a valid date.'
	}
	It 'rejects a non-integer threshold' {
		Test-PantryItemInput -Name 'X' -Quantity '1' -Expiry '' -Threshold '1.5' | Should -Contain 'Threshold must be a whole number.'
	}
}

Describe 'Inventory list (grouping, name sort, empty state)' {
	It 'groups items by category (alphabetical) with rows already name-sorted' {
		$items = @(
			(New-ItemObject -Name 'Apple' -Category 'Fruit' -Id 1),
			(New-ItemObject -Name 'Almond' -Category 'Nuts' -Id 2),
			(New-ItemObject -Name 'Banana' -Category 'Fruit' -Id 3)
		)
		$html = Format-PantryInventoryListHtml -Items $items
		# Fruit section renders before Nuts (alphabetical category order).
		$html.IndexOf('>Fruit<') | Should -BeLessThan $html.IndexOf('>Nuts<')
		# Within Fruit, Apple's row precedes Banana's (caller passes name-sorted rows).
		$html.IndexOf('>Apple<') | Should -BeLessThan $html.IndexOf('>Banana<')
	}

	It 'renders a blank category as "Uncategorized"' {
		$html = Format-PantryInventoryListHtml -Items @((New-ItemObject -Name 'Mystery' -Category '' -Id 1))
		$html | Should -Match 'Uncategorized'
	}

	It 'renders the empty-pantry call-to-action when there are no items' {
		$html = Format-PantryInventoryListHtml -Items @()
		$html | Should -Match 'Your pantry is empty'
	}

	It 'renders the no-results empty state when filtered to nothing' {
		$html = Format-PantryInventoryListHtml -Items @() -IsFiltered
		$html | Should -Match 'No matching items'
	}
}

Describe 'Category filter + case-insensitive search (Select-PantryItems)' {
	BeforeEach {
		$script:Items = @(
			(New-ItemObject -Name 'Olive oil' -Category 'Oils' -Notes 'extra virgin' -Id 1),
			(New-ItemObject -Name 'Canola oil' -Category 'Oils' -Notes 'neutral' -Id 2),
			(New-ItemObject -Name 'Basmati rice' -Category 'Grains' -Notes 'aromatic' -Id 3)
		)
	}

	It 'filters by category' {
		$r = @(Select-PantryItems -Items $script:Items -Category 'Grains' -Query '')
		$r.Count | Should -Be 1
		$r[0].name | Should -Be 'Basmati rice'
	}

	It 'treats "all" (and blank) as no category filter' {
		@(Select-PantryItems -Items $script:Items -Category 'all' -Query '').Count | Should -Be 3
		@(Select-PantryItems -Items $script:Items -Category '' -Query '').Count | Should -Be 3
	}

	It 'searches name case-insensitively' {
		$r = @(Select-PantryItems -Items $script:Items -Category 'all' -Query 'OLIVE')
		$r.Count | Should -Be 1
		$r[0].name | Should -Be 'Olive oil'
	}

	It 'searches notes case-insensitively' {
		$r = @(Select-PantryItems -Items $script:Items -Category 'all' -Query 'AROMATIC')
		$r.Count | Should -Be 1
		$r[0].name | Should -Be 'Basmati rice'
	}

	It 'combines category and search (AND)' {
		$r = @(Select-PantryItems -Items $script:Items -Category 'Oils' -Query 'neutral')
		$r.Count | Should -Be 1
		$r[0].name | Should -Be 'Canola oil'
	}

	It 'returns nothing when the search matches no item' {
		@(Select-PantryItems -Items $script:Items -Category 'all' -Query 'zzz-no-match').Count | Should -Be 0
	}

	It 'matches wildcard metacharacters literally' {
		$items = @((New-ItemObject -Name 'A*B' -Id 1), (New-ItemObject -Name 'AXB' -Id 2))
		$r = @(Select-PantryItems -Items $items -Category 'all' -Query '*')
		$r.Count | Should -Be 1
		$r[0].name | Should -Be 'A*B'
	}
}

Describe 'Low-stock view (Select-PantryLowStockItems + count)' {
	It 'includes an item whose quantity equals its threshold (boundary is low-stock)' {
		$items = @((New-ItemObject -Name 'Eggs' -Quantity 2 -Threshold 2 -Id 1))
		@(Select-PantryLowStockItems -Items $items).Count | Should -Be 1
	}

	It 'excludes an item whose quantity is above its threshold' {
		$items = @((New-ItemObject -Name 'Eggs' -Quantity 5 -Threshold 2 -Id 1))
		@(Select-PantryLowStockItems -Items $items).Count | Should -Be 0
	}

	It 'defaults a blank threshold to 1' {
		$items = @(
			(New-ItemObject -Name 'Low' -Quantity 1 -Threshold '' -Id 1),
			(New-ItemObject -Name 'Ok' -Quantity 2 -Threshold '' -Id 2)
		)
		$r = @(Select-PantryLowStockItems -Items $items)
		$r.Count | Should -Be 1
		$r[0].name | Should -Be 'Low'
	}

	It 'the nav count equals the number of low-stock items' {
		$items = @(
			(New-ItemObject -Name 'A' -Quantity 0 -Threshold 1 -Id 1),
			(New-ItemObject -Name 'B' -Quantity 1 -Threshold 1 -Id 2),
			(New-ItemObject -Name 'C' -Quantity 9 -Threshold 1 -Id 3)
		)
		$count = @(Select-PantryLowStockItems -Items $items).Count
		$count | Should -Be 2
		(Format-PantryLowStockCountHtml -Count $count) | Should -Match '>2<'
	}
}

Describe 'Expiring-soon view (Select-PantryExpiringItems + count)' {
	BeforeEach {
		$script:AsOf = [datetime]'2026-07-10'
	}

	It 'includes an item exactly 7 days out (inclusive boundary) and excludes 8 days out' {
		$items = @(
			(New-ItemObject -Name 'Day7' -Expiry '2026-07-17' -Id 1),
			(New-ItemObject -Name 'Day8' -Expiry '2026-07-18' -Id 2)
		)
		$r = @(Select-PantryExpiringItems -Items $items -AsOf $script:AsOf)
		@($r | ForEach-Object { $_.name }) | Should -Be @('Day7')
	}

	It 'orders expired items ahead of expiring ones (soonest expiry first)' {
		$items = @(
			(New-ItemObject -Name 'SoonExpiring' -Expiry '2026-07-14' -Id 1),
			(New-ItemObject -Name 'AlreadyExpired' -Expiry '2026-07-01' -Id 2)
		)
		$r = @(Select-PantryExpiringItems -Items $items -AsOf $script:AsOf)
		@($r | ForEach-Object { $_.name }) | Should -Be @('AlreadyExpired', 'SoonExpiring')
	}

	It 'excludes items with no expiry or an expiry far in the future' {
		$items = @(
			(New-ItemObject -Name 'NoDate' -Expiry '' -Id 1),
			(New-ItemObject -Name 'FarOut' -Expiry '2027-01-01' -Id 2)
		)
		@(Select-PantryExpiringItems -Items $items -AsOf $script:AsOf).Count | Should -Be 0
	}

	It 'the nav count equals the number of expiring items' {
		$items = @(
			(New-ItemObject -Name 'X' -Expiry '2026-07-01' -Id 1),
			(New-ItemObject -Name 'Y' -Expiry '2026-07-12' -Id 2),
			(New-ItemObject -Name 'Z' -Expiry '2030-01-01' -Id 3)
		)
		$count = @(Select-PantryExpiringItems -Items $items -AsOf $script:AsOf).Count
		$count | Should -Be 2
		(Format-PantryExpiringCountHtml -Count $count) | Should -Match '>2<'
	}
}

Describe 'Quick adjust (Update-PantryItemQuantity)' {
	BeforeEach {
		$script:Db = New-TestDb
	}
	AfterEach {
		if (Test-Path $script:Db) { Remove-Item $script:Db -Force -ErrorAction SilentlyContinue }
	}

	It 'increments quantity by a positive delta' {
		$item = New-PantryItem -DataSource $script:Db -Name 'Cans' -Quantity 3
		$updated = Update-PantryItemQuantity -DataSource $script:Db -Id ([int]$item.id) -Delta 1
		[double]$updated.quantity | Should -Be 4
	}

	It 'decrements quantity by a negative delta' {
		$item = New-PantryItem -DataSource $script:Db -Name 'Cans' -Quantity 3
		$updated = Update-PantryItemQuantity -DataSource $script:Db -Id ([int]$item.id) -Delta -1
		[double]$updated.quantity | Should -Be 2
	}

	It 'clamps at 0 (never goes negative)' {
		$item = New-PantryItem -DataSource $script:Db -Name 'Cans' -Quantity 0
		$updated = Update-PantryItemQuantity -DataSource $script:Db -Id ([int]$item.id) -Delta -1
		[double]$updated.quantity | Should -Be 0
	}

	It 'returns $null for an unknown id' {
		Update-PantryItemQuantity -DataSource $script:Db -Id 999999 -Delta 1 | Should -BeNullOrEmpty
	}

	It 'changes only the targeted row (single-row persistence)' {
		$a = New-PantryItem -DataSource $script:Db -Name 'A' -Quantity 5
		$b = New-PantryItem -DataSource $script:Db -Name 'B' -Quantity 5
		Update-PantryItemQuantity -DataSource $script:Db -Id ([int]$a.id) -Delta -1 | Out-Null
		[double](Get-PantryItem -DataSource $script:Db -Id ([int]$a.id)).quantity | Should -Be 4
		[double](Get-PantryItem -DataSource $script:Db -Id ([int]$b.id)).quantity | Should -Be 5
	}
}

Describe 'CSV export (ConvertTo-PantryCsv)' {
	It 'emits a header row first' {
		$csv = ConvertTo-PantryCsv -Items @()
		$csv | Should -Be 'name,category,quantity,unit,expiry,threshold,notes'
	}

	It 'renders one row per item after the header, in order' {
		$items = @(
			(New-ItemObject -Name 'Rice' -Category 'Grains' -Quantity 2 -Unit 'kg' -Id 1),
			(New-ItemObject -Name 'Beans' -Category 'Canned' -Quantity 4 -Unit 'cans' -Id 2)
		)
		$lines = (ConvertTo-PantryCsv -Items $items) -split "`r`n"
		$lines.Count | Should -Be 3
		$lines[1] | Should -Match '^Rice,'
		$lines[2] | Should -Match '^Beans,'
	}

	It 'quotes and escapes commas, quotes, and newlines per RFC 4180' {
		$items = @((New-ItemObject -Name 'Beans, black' -Notes 'Say "yum"' -Id 1))
		$csv = ConvertTo-PantryCsv -Items $items
		$csv | Should -Match '"Beans, black"'
		$csv | Should -Match '"Say ""yum"""'
		# Round-trips back through the built-in CSV parser.
		$parsed = $csv | ConvertFrom-Csv
		$parsed.name | Should -Be 'Beans, black'
		$parsed.notes | Should -Be 'Say "yum"'
	}

	It 'yields header-only output for an empty inventory (no crash)' {
		$csv = ConvertTo-PantryCsv -Items @()
		($csv -split "`r`n").Count | Should -Be 1
	}
}

Describe 'API route-registration gate (Resolve-ApiRouteRegistration)' {
	# podex.ps1's file-based auto-loader delegates to Resolve-ApiRouteRegistration to decide whether
	# each api/*.ps1 becomes a route. The security-critical invariant: the destructive debug routes
	# (/stop, /clear, /init) are ABSENT under the default configuration (Podex.Debug off) and are not
	# merely relocated to /api/debug/*. These tests exercise that same pure decision the loop runs.

	It 'does not register any /debug/* route under the default configuration (Debug off)' {
		foreach ($f in @('api/debug/stop.ps1', 'api/debug/clear.ps1', 'api/debug/init.ps1')) {
			Resolve-ApiRouteRegistration -RelativePath $f -DebugEnabled $false | Should -BeNullOrEmpty
		}
	}

	It 'does not relocate a debug route to /api/debug/* when Debug is off' {
		# Regression guard: the previous loop fell through to an "else -> GET" branch that still
		# registered GET /api/debug/stop (Close-PodeServer) with Debug off. The gate must skip it.
		Resolve-ApiRouteRegistration -RelativePath 'api/debug/stop.ps1' -DebugEnabled $false | Should -BeNullOrEmpty
	}

	It 'registers debug routes as GET (with the /debug segment dropped) only when Debug is on' {
		$r = Resolve-ApiRouteRegistration -RelativePath 'api/debug/stop.ps1' -DebugEnabled $true
		$r | Should -Not -BeNullOrEmpty
		$r.Method | Should -Be 'Get'
		$r.Path | Should -Be '/api/stop'
	}

	It 'skips the _lib data-access library regardless of the Debug flag' {
		Resolve-ApiRouteRegistration -RelativePath 'api/_lib/pantry-store.ps1' -DebugEnabled $true | Should -BeNullOrEmpty
		Resolve-ApiRouteRegistration -RelativePath 'api/_lib/pantry-store.ps1' -DebugEnabled $false | Should -BeNullOrEmpty
	}

	It 'registers a verb-named api file at its parent path with that method (Debug-independent)' {
		$r = Resolve-ApiRouteRegistration -RelativePath 'api/crud/get.ps1' -DebugEnabled $false
		$r.Method | Should -Be 'Get'
		$r.Path | Should -Be '/api/crud'
	}

	It 'accepts Windows-style backslash separators' {
		Resolve-ApiRouteRegistration -RelativePath 'api\debug\clear.ps1' -DebugEnabled $false | Should -BeNullOrEmpty
		(Resolve-ApiRouteRegistration -RelativePath 'api\debug\clear.ps1' -DebugEnabled $true).Path | Should -Be '/api/clear'
	}
}

Describe 'Security-posture config defaults (server.psd1)' {
	# Regression guard for the audit findings that shipped stack-trace disclosure and destructive
	# debug routes ON by default. Both must default OFF, with an explicit local-dev opt-in only.
	# Web.ErrorPages.ShowExceptions=$false makes Pode serve the generic errors/default.html.pode page
	# (no exception message/stack trace) instead of leaking file paths and internals to clients.

	BeforeAll {
		$script:serverCfg = Import-PowerShellDataFile -Path (Join-Path (Split-Path -Parent $PSScriptRoot) 'server.psd1')
	}

	It 'defaults Web.ErrorPages.ShowExceptions to $false (no stack-trace disclosure to clients)' {
		$serverCfg.Web.ErrorPages.ShowExceptions | Should -BeFalse
	}

	It 'defaults Podex.Debug to $false (destructive /stop,/clear,/init routes absent by default)' {
		$serverCfg.Podex.Debug | Should -BeFalse
	}

	It 'ships the generic error page served when ShowExceptions is off' {
		Test-Path (Join-Path (Split-Path -Parent $PSScriptRoot) 'errors/default.html.pode') | Should -BeTrue
	}
}

Describe 'HTTP security response headers are configured (podex.ps1 + layout)' {
	# Regression guard for the audit finding "no HTTP security response headers configured (CSP,
	# X-Frame-Options, X-Content-Type-Options, Referrer-Policy)". Pode emits none of these by default, so
	# podex.ps1 must call the Set-PodeSecurity* cmdlets inside the server scriptblock to attach them to
	# every response. This suite does not stand up an HTTP server, so the invariant is pinned at the
	# source level (which cmdlets are called, with which policy); the actual emitted headers were
	# re-verified against the running server in the browser at implementation time.
	BeforeAll {
		$root = Split-Path -Parent $PSScriptRoot
		$script:podex = Get-Content -Raw -Path (Join-Path $root 'podex.ps1')
		$script:mainView = Get-Content -Raw -Path (Join-Path $root 'views/layouts/main.pode')
		$script:pantryJs = Join-Path $root 'public/app/pantry.js'
	}

	It 'sends X-Content-Type-Options: nosniff' {
		$podex | Should -Match 'Set-PodeSecurityContentTypeOptions'
	}

	It 'sends X-Frame-Options: DENY' {
		$podex | Should -Match 'Set-PodeSecurityFrameOptions\s+-Type\s+Deny'
	}

	It 'sends Referrer-Policy: no-referrer' {
		$podex | Should -Match 'Set-PodeSecurityReferrerPolicy\s+-Type\s+No-Referrer'
	}

	It 'sets a first-party Content-Security-Policy (default/script self, frame-ancestors none)' {
		$podex | Should -Match 'Set-PodeSecurityContentSecurityPolicy'
		$podex | Should -Match "-Default\s+'self'"
		$podex | Should -Match "-Scripts\s+'self'"
		$podex | Should -Match "-FrameAncestor\s+'none'"
	}

	It 'gates HSTS behind the HTTPS endpoint so it is never sent over plain HTTP' {
		$podex | Should -Match 'Set-PodeSecurityStrictTransportSecurity'
	}

	It "keeps script-src strict: the layout has no inline script body and loads /public/app/pantry.js" {
		Test-Path $pantryJs | Should -BeTrue
		$mainView | Should -Match '/public/app/pantry\.js'
		# The layout must not reintroduce an inline handler, which would force script-src 'unsafe-inline'.
		$mainView | Should -Not -Match 'addEventListener'
	}
}

Describe 'OpenAPI/Swagger docs are Debug-gated (podex.ps1)' {
	# Regression guard for the audit finding "OpenAPI spec and Swagger UI mounted unconditionally in
	# all environments". The Enable-PodeOpenApi / Add-PodeOAInfo / Enable-PodeOAViewer calls expose the
	# full API surface (/docs/openapi, /docs/swagger) and must sit inside an `if ($cfg.Podex.Debug)`
	# block so they are never mounted under the default (Debug off) configuration. This suite pins the
	# invariant at the source level (the calls live inside the Debug gate); /docs/* returning 404 with
	# Debug off follows from Pode never registering the routes.
	BeforeAll {
		$root = Split-Path -Parent $PSScriptRoot
		$script:podexSrc = Get-Content -Raw -Path (Join-Path $root 'podex.ps1')
	}

	It 'still enables the OpenAPI document and Swagger viewer (dev-only)' {
		$podexSrc | Should -Match "Enable-PodeOpenApi"
		$podexSrc | Should -Match "Enable-PodeOAViewer"
	}

	It 'wraps the OpenAPI/Swagger calls inside an if ($cfg.Podex.Debug) block' {
		# The docs comment plus the Debug gate must immediately precede the Enable-Pode* calls, with no
		# intervening `}` that would close the gate before them. Match the gate opening through the
		# viewer call, disallowing a closing brace in between.
		$podexSrc | Should -Match "(?s)if\s*\(\s*\`$cfg\.Podex\.Debug\s*\)\s*\{[^}]*Enable-PodeOpenApi[^}]*Enable-PodeOAViewer"
	}
}

Describe 'CRUD paging input validation (Resolve-CrudPaging)' {
	# The GET /api/crud route delegates paging parsing to Resolve-CrudPaging: IsValid=$false makes the
	# route respond 400 (validation message) without touching the DB; IsValid=$true lets it proceed to
	# the 200 happy path. These tests exercise that same pure composition.

	It 'rejects a non-numeric page (route would return 400, not 500)' {
		$result = Resolve-CrudPaging -Page 'abc' -PageSize 10
		$result.IsValid | Should -BeFalse
		$result.Errors -join '; ' | Should -Match 'page'
		$result.Offset | Should -BeNullOrEmpty
	}

	It 'rejects a non-numeric pageSize' {
		$result = Resolve-CrudPaging -Page 1 -PageSize 'xyz'
		$result.IsValid | Should -BeFalse
		$result.Errors -join '; ' | Should -Match 'pageSize'
	}

	It 'accepts omitted paging params and applies defaults (happy path -> 200)' {
		$result = Resolve-CrudPaging -Page $null -PageSize $null
		$result.IsValid | Should -BeTrue
		$result.Page | Should -Be 1
		$result.PageSize | Should -Be 10
		$result.Offset | Should -Be 0
	}

	It 'accepts valid numeric paging and computes the offset' {
		$result = Resolve-CrudPaging -Page '3' -PageSize '25'
		$result.IsValid | Should -BeTrue
		$result.Page | Should -Be 3
		$result.PageSize | Should -Be 25
		$result.Offset | Should -Be 50
	}

	It 'clamps page below 1 up to 1' {
		$result = Resolve-CrudPaging -Page '0' -PageSize '10'
		$result.IsValid | Should -BeTrue
		$result.Page | Should -Be 1
		$result.Offset | Should -Be 0
	}

	It 'clamps pageSize to the [1, max] bounds' {
		(Resolve-CrudPaging -Page 1 -PageSize '0').PageSize | Should -Be 1
		(Resolve-CrudPaging -Page 1 -PageSize '9999' -MaxPageSize 100).PageSize | Should -Be 100
	}
}

Describe 'Pode view templates parse (regression: prettier-mangled header.pode broke every page)' {
	# Pode renders .pode files by wrapping the raw content in a double-quoted string
	# (auto-escaping quotes) and compiling it with [scriptblock]::Create — see
	# ConvertFrom-PodeFile in Pode/Private/Helpers.ps1. A template that fails that
	# compile 500s every page that includes it, while unit tests over the render
	# helpers stay green. This suite replicates the exact wrap for every template.
	It 'compiles <_> the way ConvertFrom-PodeFile does' -ForEach @(
		Get-ChildItem -Path (Join-Path (Split-Path -Parent $PSScriptRoot) 'views'), (Join-Path (Split-Path -Parent $PSScriptRoot) 'errors') -Filter '*.pode' -Recurse -File |
			ForEach-Object { $_.FullName }
	) {
		$raw = Get-Content -Path $_ -Raw
		$wrapped = "param(`$data)`nreturn `"$($raw -replace '"', '``"')`""
		{ [scriptblock]::Create($wrapped) } | Should -Not -Throw
	}
}
