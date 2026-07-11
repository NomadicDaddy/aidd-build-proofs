# Pantry HTML render layer.
#
# Server-rendered HTML fragment builders for the inventory list and the item-CRUD flow. Keeping the
# markup here (rather than inline in each route/view) means the full-page inventory render and the
# htmx partial swaps produce identical rows from one source of truth.
#
# This file defines functions only - it registers no routes (route auto-discovery in podex.ps1 skips
# the api/_lib directory). Load it by dot-sourcing:  . ./api/_lib/pantry-render.ps1
# It depends on pantry-store.ps1 (Get-PantryExpiryState); dot-source that alongside it.

# HTML-encode a value for safe interpolation into element text or a double-quoted attribute.
function Protect-PantryHtml {
	param([string]$Value)
	return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

# Format an item's quantity + unit for display: whole numbers drop the trailing ".0", the unit is
# appended when present (e.g. "2 cartons", "1.5 kg", "3").
function Format-PantryQuantityText {
	param($Item)
	$q = [double]$Item.quantity
	$qtyText = if ($q -eq [math]::Floor($q)) { [string][int]$q } else { [string]$q }
	if ([string]::IsNullOrWhiteSpace([string]$Item.unit)) { return $qtyText }
	return "$qtyText $(Protect-PantryHtml ([string]$Item.unit))"
}

# Expiry badge markup (red "Expired" / amber "Expiring soon") plus the raw expiry date note.
# Text + colour so meaning is never colour-only. Empty string when the item has no relevant expiry.
function Get-PantryBadgeHtml {
	param($Item)
	$state = [string]$Item.expiryState
	if ([string]::IsNullOrWhiteSpace($state)) { $state = Get-PantryExpiryState -Expiry ([string]$Item.expiry) }
	$badge = ''
	switch ($state) {
		'expired' { $badge = "<span class='inline-flex items-center rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white'>Expired</span>" }
		'expiring' { $badge = "<span class='inline-flex items-center rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-amber-950'>Expiring soon</span>" }
	}
	$note = ''
	if (-not [string]::IsNullOrWhiteSpace([string]$Item.expiry)) {
		$note = "<span class='ml-2 text-xs text-gray-500 dark:text-gray-400'>$(Protect-PantryHtml ([string]$Item.expiry))</span>"
	}
	return "$badge$note"
}

# A read-only item row (the default state of every row in the inventory table). Carries a stable
# id="item-row-{id}" so htmx add/edit/delete can target and swap just this row.
function Format-PantryItemRowHtml {
	param($Item)
	$id = [int]$Item.id
	$name = Protect-PantryHtml ([string]$Item.name)
	$qty = Format-PantryQuantityText -Item $Item
	$status = Get-PantryBadgeHtml -Item $Item

	# Quick-adjust +/- controls: each posts a signed delta and swaps just this row (the server clamps
	# the quantity at 0). The - button is also disabled at 0 so it reads as unavailable, not just
	# a no-op. 'itemChanged' fires on the response so a cross-threshold adjust refreshes the nav counts.
	$qnum = 0.0
	[void][double]::TryParse([string]$Item.quantity, [ref]$qnum)
	$decDisabled = if ($qnum -le 0) { ' disabled' } else { '' }
	$adjBtnCls = 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus:outline-hidden focus:ring-4 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'

	$sb = [System.Text.StringBuilder]::new()
	[void]$sb.Append("<tr id='item-row-$id' class='border-t border-gray-100 dark:border-gray-700'>")
	[void]$sb.Append("<td class='px-4 py-3 font-medium text-gray-900 dark:text-white'>$name</td>")
	[void]$sb.Append("<td class='px-4 py-3 text-gray-700 dark:text-gray-300'>")
	[void]$sb.Append("<div class='flex items-center gap-2'>")
	[void]$sb.Append("<button type='button' id='item-dec-$id'$decDisabled class='$adjBtnCls' aria-label='Decrease quantity of $name' hx-post='/htmx/item-adjust?id=$id&amp;delta=-1' hx-target='#item-row-$id' hx-swap='outerHTML'>&minus;</button>")
	[void]$sb.Append("<span class='min-w-12 text-center tabular-nums'>$qty</span>")
	[void]$sb.Append("<button type='button' id='item-inc-$id' class='$adjBtnCls' aria-label='Increase quantity of $name' hx-post='/htmx/item-adjust?id=$id&amp;delta=1' hx-target='#item-row-$id' hx-swap='outerHTML'>+</button>")
	[void]$sb.Append('</div></td>')
	[void]$sb.Append("<td class='px-4 py-3 whitespace-nowrap'>$status</td>")
	[void]$sb.Append("<td class='px-4 py-3 text-right whitespace-nowrap'>")
	[void]$sb.Append("<button type='button' class='mr-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 focus:outline-hidden focus:ring-4 focus:ring-gray-200 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700' hx-get='/htmx/item-edit?id=$id' hx-target='#item-row-$id' hx-swap='outerHTML'>Edit</button>")
	[void]$sb.Append("<button type='button' class='rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-hidden focus:ring-4 focus:ring-red-200 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950' hx-delete='/htmx/item-delete?id=$id' hx-confirm='Delete this item? This cannot be undone.' hx-target='#item-row-$id' hx-swap='outerHTML'>Delete</button>")
	[void]$sb.Append('</td></tr>')
	return $sb.ToString()
}

# The grid of labeled inputs shared by the add form and the inline edit form. $IdPrefix keeps input
# ids unique per instance (so multiple rows can be edited without id collisions); $Values pre-fills
# fields (accepts a form-data hashtable or an item PSObject).
function Get-PantryItemFieldsHtml {
	param(
		[string]$IdPrefix,
		$Values
	)
	$name = Protect-PantryHtml ([string]$Values.name)
	$category = Protect-PantryHtml ([string]$Values.category)
	$quantity = Protect-PantryHtml ([string]$Values.quantity)
	$unit = Protect-PantryHtml ([string]$Values.unit)
	$expiry = Protect-PantryHtml ([string]$Values.expiry)
	$threshold = Protect-PantryHtml ([string]$Values.threshold)
	$notes = Protect-PantryHtml ([string]$Values.notes)

	$inputCls = 'block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-600 dark:text-white dark:placeholder-gray-400'
	$labelCls = 'mb-1 block text-sm font-medium text-gray-900 dark:text-white'

	$sb = [System.Text.StringBuilder]::new()
	[void]$sb.Append("<div class='grid grid-cols-1 gap-4 sm:grid-cols-2'>")
	[void]$sb.Append("<div class='sm:col-span-2'><label for='$IdPrefix-name' class='$labelCls'>Name</label><input type='text' name='name' id='$IdPrefix-name' value='$name' required class='$inputCls' placeholder='e.g. Olive oil' /></div>")
	[void]$sb.Append("<div><label for='$IdPrefix-category' class='$labelCls'>Category</label><input type='text' name='category' id='$IdPrefix-category' value='$category' class='$inputCls' placeholder='e.g. Oils' /></div>")
	[void]$sb.Append("<div><label for='$IdPrefix-unit' class='$labelCls'>Unit</label><input type='text' name='unit' id='$IdPrefix-unit' value='$unit' class='$inputCls' placeholder='e.g. bottles' /></div>")
	[void]$sb.Append("<div><label for='$IdPrefix-quantity' class='$labelCls'>Quantity</label><input type='number' step='any' min='0' name='quantity' id='$IdPrefix-quantity' value='$quantity' required class='$inputCls' placeholder='0' /></div>")
	[void]$sb.Append("<div><label for='$IdPrefix-threshold' class='$labelCls'>Low-stock threshold</label><input type='number' step='1' min='0' name='threshold' id='$IdPrefix-threshold' value='$threshold' class='$inputCls' placeholder='1' /></div>")
	[void]$sb.Append("<div><label for='$IdPrefix-expiry' class='$labelCls'>Expiry date</label><input type='date' name='expiry' id='$IdPrefix-expiry' value='$expiry' class='$inputCls' /></div>")
	[void]$sb.Append("<div class='sm:col-span-2'><label for='$IdPrefix-notes' class='$labelCls'>Notes</label><textarea name='notes' id='$IdPrefix-notes' rows='2' class='$inputCls' placeholder='Optional notes'>$notes</textarea></div>")
	[void]$sb.Append('</div>')
	return $sb.ToString()
}

# Render a validation-error summary block. Empty string when there are no errors.
function Get-PantryErrorsHtml {
	param([string[]]$Errors)
	if (-not $Errors -or $Errors.Count -eq 0) { return '' }
	$sb = [System.Text.StringBuilder]::new()
	[void]$sb.Append("<div role='alert' class='mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300'><ul class='list-inside list-disc space-y-1'>")
	foreach ($e in $Errors) { [void]$sb.Append("<li>$(Protect-PantryHtml $e)</li>") }
	[void]$sb.Append('</ul></div>')
	return $sb.ToString()
}

# The add-item form (modal content). $Values re-fills the fields on a validation error; $Errors
# renders the error summary. Posts to /htmx/item-create, replacing the inventory list on success.
function Format-PantryItemFormHtml {
	param(
		$Values = @{},
		[string[]]$Errors = @()
	)
	$errHtml = Get-PantryErrorsHtml -Errors $Errors
	$fields = Get-PantryItemFieldsHtml -IdPrefix 'add' -Values $Values

	$sb = [System.Text.StringBuilder]::new()
	[void]$sb.Append("<div role='dialog' aria-modal='true' aria-labelledby='addItemTitle' class='w-full max-w-lg rounded-lg bg-white shadow-sm dark:bg-gray-700'>")
	[void]$sb.Append("<div class='flex items-center justify-between rounded-t border-b p-4 dark:border-gray-600'>")
	[void]$sb.Append("<h2 id='addItemTitle' class='text-xl font-semibold text-gray-900 dark:text-white'>Add item</h2>")
	[void]$sb.Append("<button type='button' aria-label='Close' class='ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white' hx-on:click=`"htmx.trigger('body', 'closeModal')`"><svg class='h-5 w-5' fill='currentColor' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'><path fill-rule='evenodd' d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z' clip-rule='evenodd'></path></svg></button>")
	[void]$sb.Append('</div>')
	[void]$sb.Append("<form hx-post='/htmx/item-create' hx-target='#inventory-list' hx-swap='outerHTML'>")
	[void]$sb.Append("<div class='p-6'>$errHtml$fields</div>")
	[void]$sb.Append("<div class='flex items-center space-x-2 rounded-b border-t border-gray-200 p-6 dark:border-gray-600'>")
	[void]$sb.Append("<button type='submit' class='rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:outline-hidden focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800'>Add item</button>")
	[void]$sb.Append("<button type='button' class='rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-hidden focus:ring-4 focus:ring-gray-200 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white' hx-on:click=`"htmx.trigger('body', 'closeModal')`">Cancel</button>")
	[void]$sb.Append('</div></form></div>')
	return $sb.ToString()
}

# The inline edit form, rendered as the row itself (same id="item-row-{id}" so it swaps in place).
# Saving PUTs to /htmx/item-update and swaps the row back to its read-only form; Cancel re-fetches
# the unchanged read-only row.
function Format-PantryItemEditRowHtml {
	param(
		$Item,
		[string[]]$Errors = @()
	)
	$id = [int]$Item.id
	$errHtml = Get-PantryErrorsHtml -Errors $Errors
	$fields = Get-PantryItemFieldsHtml -IdPrefix "edit-$id" -Values $Item

	$sb = [System.Text.StringBuilder]::new()
	[void]$sb.Append("<tr id='item-row-$id' class='border-t border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'>")
	[void]$sb.Append("<td colspan='4' class='px-4 py-4'>")
	[void]$sb.Append("<form hx-put='/htmx/item-update' hx-target='#item-row-$id' hx-swap='outerHTML'>")
	[void]$sb.Append("<input type='hidden' name='id' value='$id' />")
	[void]$sb.Append($errHtml)
	[void]$sb.Append($fields)
	[void]$sb.Append("<div class='mt-4 flex items-center space-x-2'>")
	[void]$sb.Append("<button type='submit' class='rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus:outline-hidden focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800'>Save</button>")
	[void]$sb.Append("<button type='button' class='rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 focus:outline-hidden focus:ring-4 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600' hx-get='/htmx/item-row?id=$id' hx-target='#item-row-$id' hx-swap='outerHTML'>Cancel</button>")
	[void]$sb.Append('</div></form></td></tr>')
	return $sb.ToString()
}

# The filter bar rendered above the inventory list: a labeled category <select> and a labeled text
# search input. Changing either (or submitting) issues an hx-get to /htmx/inventory-filter and swaps
# just #inventory-list - no full page reload. Category options are the distinct item categories
# (blank -> "Uncategorized"), sorted, plus an "All categories" default. $SelectedCategory / $Query
# pre-fill the current filter state so a full-page render reflects any active filter.
function Format-PantryFilterBarHtml {
	param(
		$Items,
		[string]$SelectedCategory = 'all',
		[string]$Query = ''
	)
	$Items = @($Items)
	$cats = @($Items | ForEach-Object {
			if ([string]::IsNullOrWhiteSpace([string]$_.category)) { 'Uncategorized' } else { [string]$_.category }
		} | Sort-Object -Unique)

	$labelCls = 'mb-1 block text-sm font-medium text-gray-900 dark:text-white'
	$ctrlCls = 'block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-600 dark:text-white dark:placeholder-gray-400'

	$sb = [System.Text.StringBuilder]::new()
	[void]$sb.Append("<form id='inventory-filter' role='search' class='mb-4 flex flex-col gap-4 sm:flex-row sm:items-end' hx-get='/htmx/inventory-filter' hx-target='#inventory-list' hx-swap='outerHTML' hx-trigger='change, search, keyup changed delay:300ms, submit'>")

	# category select
	[void]$sb.Append("<div class='sm:w-56'>")
	[void]$sb.Append("<label for='filter-category' class='$labelCls'>Category</label>")
	[void]$sb.Append("<select name='category' id='filter-category' class='$ctrlCls'>")
	$allSel = if ([string]::IsNullOrWhiteSpace($SelectedCategory) -or $SelectedCategory -eq 'all') { ' selected' } else { '' }
	[void]$sb.Append("<option value='all'$allSel>All categories</option>")
	foreach ($c in $cats) {
		$sel = if ($c -eq $SelectedCategory) { ' selected' } else { '' }
		$cEnc = Protect-PantryHtml $c
		[void]$sb.Append("<option value='$cEnc'$sel>$cEnc</option>")
	}
	[void]$sb.Append('</select></div>')

	# text search
	$qEnc = Protect-PantryHtml $Query
	[void]$sb.Append("<div class='sm:flex-1'>")
	[void]$sb.Append("<label for='filter-search' class='$labelCls'>Search</label>")
	[void]$sb.Append("<input type='search' name='q' id='filter-search' value='$qEnc' class='$ctrlCls' placeholder='Search name or notes' autocomplete='off' />")
	[void]$sb.Append('</div>')

	# submit button (keyboard/no-JS fallback; htmx also swaps live on change/typing)
	[void]$sb.Append("<div><button type='submit' class='w-full rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:outline-hidden focus:ring-4 focus:ring-blue-300 sm:w-auto dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800'>Search</button></div>")

	[void]$sb.Append('</form>')
	return $sb.ToString()
}

# The full inventory list fragment: items grouped by category (blank -> "Uncategorized"), categories
# sorted alphabetically, rows already name-sorted by the DAL. Wrapped in <div id="inventory-list">
# so add/create swaps replace the whole list (re-grouping correctly). Renders an empty state with a
# call-to-action when there are no items; when -IsFiltered is set the empty state is instead a clear
# "no results" message (the pantry has items, they just don't match the active filter).
function Format-PantryInventoryListHtml {
	param(
		$Items,
		[switch]$IsFiltered
	)
	$Items = @($Items)
	foreach ($it in $Items) {
		$it | Add-Member -NotePropertyName 'expiryState' -NotePropertyValue (Get-PantryExpiryState -Expiry ([string]$it.expiry)) -Force
	}

	$sb = [System.Text.StringBuilder]::new()
	[void]$sb.Append("<div id='inventory-list'>")

	if ($Items.Count -eq 0 -and $IsFiltered) {
		[void]$sb.Append("<div class='rounded-lg border-2 border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800'>")
		[void]$sb.Append("<h2 class='text-lg font-semibold text-gray-800 dark:text-gray-200'>No matching items</h2>")
		[void]$sb.Append("<p class='mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400'>No pantry items match the selected category or search term. Try a different search or reset the filters.</p>")
		[void]$sb.Append('</div>')
	} elseif ($Items.Count -eq 0) {
		[void]$sb.Append("<div class='rounded-lg border-2 border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800'>")
		[void]$sb.Append("<h2 class='text-lg font-semibold text-gray-800 dark:text-gray-200'>Your pantry is empty</h2>")
		[void]$sb.Append("<p class='mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400'>Nothing is being tracked yet. Add your first item to start keeping tabs on what is in stock.</p>")
		[void]$sb.Append("<button type='button' class='mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-hidden focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800' hx-get='/htmx/item-new' hx-target='#inventoryModalContent' hx-trigger='click'>")
		[void]$sb.Append("<svg class='mr-2 h-3.5 w-3.5' fill='currentColor' viewbox='0 0 20 20' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'><path clip-rule='evenodd' fill-rule='evenodd' d='M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z' /></svg>")
		[void]$sb.Append('Add your first item</button></div>')
	} else {
		$groups = @($Items | Group-Object -Property { if ([string]::IsNullOrWhiteSpace([string]$_.category)) { 'Uncategorized' } else { [string]$_.category } } | Sort-Object -Property Name)
		$idx = 0
		foreach ($g in $groups) {
			$idx++
			$catName = Protect-PantryHtml ([string]$g.Name)
			[void]$sb.Append("<section class='mb-6' aria-labelledby='cat-$idx'>")
			[void]$sb.Append("<h2 id='cat-$idx' class='mb-2 text-lg font-semibold text-gray-800 dark:text-gray-200'>$catName</h2>")
			[void]$sb.Append("<div class='overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'>")
			[void]$sb.Append("<table class='w-full text-left text-sm text-gray-500 dark:text-gray-400'>")
			[void]$sb.Append("<thead class='bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400'><tr>")
			[void]$sb.Append("<th scope='col' class='px-4 py-3'>Item</th>")
			[void]$sb.Append("<th scope='col' class='px-4 py-3'>Quantity</th>")
			[void]$sb.Append("<th scope='col' class='px-4 py-3'>Status</th>")
			[void]$sb.Append("<th scope='col' class='px-4 py-3 text-right'>Actions</th>")
			[void]$sb.Append('</tr></thead><tbody>')
			foreach ($it in $g.Group) {
				[void]$sb.Append((Format-PantryItemRowHtml -Item $it))
			}
			[void]$sb.Append('</tbody></table></div></section>')
		}
	}

	[void]$sb.Append('</div>')
	return $sb.ToString()
}

# The expiring-soon list fragment: a flat, soonest-first table of items that are expired or expiring
# within 7 days (the caller passes an already-filtered/ordered set from Select-PantryExpiringItems).
# Rows reuse Format-PantryItemRowHtml so edit/delete behave exactly as on the inventory view; the
# red "Expired" vs amber "Expiring soon" badge (text + colour, never colour-only) keeps expired
# items visually distinct from expiring ones. Wrapped in <div id="expiring-list"> which listens for
# the body-level 'itemChanged' event and re-fetches itself, so any create/edit/delete anywhere
# re-derives this list (an item edited to expire >7 days out drops straight off the view).
function Format-PantryExpiringListHtml {
	param($Items)
	$Items = @($Items)
	foreach ($it in $Items) {
		$it | Add-Member -NotePropertyName 'expiryState' -NotePropertyValue (Get-PantryExpiryState -Expiry ([string]$it.expiry)) -Force
	}

	$sb = [System.Text.StringBuilder]::new()
	[void]$sb.Append("<div id='expiring-list' hx-get='/htmx/expiring-list' hx-trigger='itemChanged from:body' hx-swap='outerHTML'>")

	if ($Items.Count -eq 0) {
		[void]$sb.Append("<div class='rounded-lg border-2 border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800'>")
		[void]$sb.Append("<h2 class='text-lg font-semibold text-gray-800 dark:text-gray-200'>Nothing expiring soon</h2>")
		[void]$sb.Append("<p class='mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400'>No items are expired or expiring within the next 7 days. Items you add with a near-term expiry date will show up here.</p>")
		[void]$sb.Append('</div>')
	} else {
		[void]$sb.Append("<div class='overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'>")
		[void]$sb.Append("<table class='w-full text-left text-sm text-gray-500 dark:text-gray-400'>")
		[void]$sb.Append("<thead class='bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400'><tr>")
		[void]$sb.Append("<th scope='col' class='px-4 py-3'>Item</th>")
		[void]$sb.Append("<th scope='col' class='px-4 py-3'>Quantity</th>")
		[void]$sb.Append("<th scope='col' class='px-4 py-3'>Status</th>")
		[void]$sb.Append("<th scope='col' class='px-4 py-3 text-right'>Actions</th>")
		[void]$sb.Append('</tr></thead><tbody>')
		foreach ($it in $Items) {
			[void]$sb.Append((Format-PantryItemRowHtml -Item $it))
		}
		[void]$sb.Append('</tbody></table></div>')
	}

	[void]$sb.Append('</div>')
	return $sb.ToString()
}

# The low-stock list fragment: a flat, name-sorted table of items whose quantity is at or below their
# reorder threshold (the caller passes an already-filtered set from Select-PantryLowStockItems). Rows
# reuse Format-PantryItemRowHtml so edit/delete behave exactly as on the inventory view (the Quantity
# column makes the at-or-below-threshold state visible). Wrapped in <div id="lowstock-list"> which
# listens for the body-level 'itemChanged' event and re-fetches itself, so any create/edit/delete
# anywhere re-derives this list (an item whose quantity is raised above its threshold drops off).
function Format-PantryLowStockListHtml {
	param($Items)
	$Items = @($Items)
	foreach ($it in $Items) {
		$it | Add-Member -NotePropertyName 'expiryState' -NotePropertyValue (Get-PantryExpiryState -Expiry ([string]$it.expiry)) -Force
	}

	$sb = [System.Text.StringBuilder]::new()
	[void]$sb.Append("<div id='lowstock-list' hx-get='/htmx/lowstock-list' hx-trigger='itemChanged from:body' hx-swap='outerHTML'>")

	if ($Items.Count -eq 0) {
		[void]$sb.Append("<div class='rounded-lg border-2 border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800'>")
		[void]$sb.Append("<h2 class='text-lg font-semibold text-gray-800 dark:text-gray-200'>Nothing running low</h2>")
		[void]$sb.Append("<p class='mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400'>No items are at or below their reorder threshold. Items whose quantity drops to its low-stock threshold will show up here.</p>")
		[void]$sb.Append('</div>')
	} else {
		[void]$sb.Append("<div class='overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'>")
		[void]$sb.Append("<table class='w-full text-left text-sm text-gray-500 dark:text-gray-400'>")
		[void]$sb.Append("<thead class='bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400'><tr>")
		[void]$sb.Append("<th scope='col' class='px-4 py-3'>Item</th>")
		[void]$sb.Append("<th scope='col' class='px-4 py-3'>Quantity</th>")
		[void]$sb.Append("<th scope='col' class='px-4 py-3'>Status</th>")
		[void]$sb.Append("<th scope='col' class='px-4 py-3 text-right'>Actions</th>")
		[void]$sb.Append('</tr></thead><tbody>')
		foreach ($it in $Items) {
			[void]$sb.Append((Format-PantryItemRowHtml -Item $it))
		}
		[void]$sb.Append('</tbody></table></div>')
	}

	[void]$sb.Append('</div>')
	return $sb.ToString()
}

# The nav "Low stock" count badge. Self-contained htmx element: it re-fetches itself on initial load
# and whenever a body-level 'itemChanged' event fires (dispatched after every create/edit/delete), so
# the nav count stays accurate on every page without each route computing it. Renders an amber pill
# with the count when there is something to flag; an empty (but still listening) span when the count
# is zero, so the badge quietly disappears rather than showing "0".
function Format-PantryLowStockCountHtml {
	param([int]$Count)
	$inner = ''
	if ($Count -gt 0) {
		$label = "$Count item$(if ($Count -ne 1) { 's' }) at or below the low-stock threshold"
		$inner = "<span class='ml-1.5 inline-flex items-center rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950' title='$(Protect-PantryHtml $label)' aria-label='$(Protect-PantryHtml $label)'>$Count</span>"
	}
	return "<span id='nav-lowstock-count' hx-get='/htmx/lowstock-count' hx-trigger='load, itemChanged from:body' hx-swap='outerHTML'>$inner</span>"
}

# The nav "Expiring" count badge. Self-contained htmx element: it re-fetches itself on initial load
# and whenever a body-level 'itemChanged' event fires (dispatched after every create/edit/delete),
# so the nav count stays accurate on every page without each route computing it. Renders a red pill
# with the count when there is something to flag; an empty (but still listening) span when the count
# is zero, so the badge quietly disappears rather than showing "0".
function Format-PantryExpiringCountHtml {
	param([int]$Count)
	$inner = ''
	if ($Count -gt 0) {
		$label = "$Count item$(if ($Count -ne 1) { 's' }) expired or expiring soon"
		$inner = "<span class='ml-1.5 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white' title='$(Protect-PantryHtml $label)' aria-label='$(Protect-PantryHtml $label)'>$Count</span>"
	}
	return "<span id='nav-expiring-count' hx-get='/htmx/expiring-count' hx-trigger='load, itemChanged from:body' hx-swap='outerHTML'>$inner</span>"
}
