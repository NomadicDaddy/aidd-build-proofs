# Shared paging helper for the file-based CRUD API routes.
#
# Kept as a pure, storage-free function (no $WebEvent, no DB) so the route stays thin and the parsing
# rules are directly unit-testable. Paging inputs arrive as raw query strings and must be parsed
# defensively: a non-numeric value is a client error (400), never an unhandled cast that surfaces as
# a 500. Valid values are clamped to sane bounds before an offset is computed.

function Resolve-CrudPaging {
	[CmdletBinding()]
	param(
		# Raw query values (usually strings); $null / '' means "not supplied" and falls back to a default.
		$Page,
		$PageSize,
		[int]$DefaultPage = 1,
		[int]$DefaultPageSize = 10,
		[int]$MaxPageSize = 100
	)

	$errors = @()

	# Parse a single paging value: blank -> default, integer -> its value, anything else -> error.
	function Get-ParsedValue {
		param($Value, [int]$Default, [string]$Name, [ref]$ErrorList)
		if ($null -eq $Value -or "$Value".Trim() -eq '') { return $Default }
		$parsed = 0
		if ([int]::TryParse("$Value".Trim(), [ref]$parsed)) { return $parsed }
		$ErrorList.Value += "$Name must be a whole number"
		return $null
	}

	$parsedPage = Get-ParsedValue -Value $Page -Default $DefaultPage -Name 'page' -ErrorList ([ref]$errors)
	$parsedPageSize = Get-ParsedValue -Value $PageSize -Default $DefaultPageSize -Name 'pageSize' -ErrorList ([ref]$errors)

	if ($errors.Count -gt 0) {
		return [pscustomobject]@{
			IsValid  = $false
			Errors   = $errors
			Page     = $null
			PageSize = $null
			Offset   = $null
		}
	}

	# Clamp to sane bounds: page >= 1, pageSize in [1, MaxPageSize].
	if ($parsedPage -lt 1) { $parsedPage = 1 }
	if ($parsedPageSize -lt 1) { $parsedPageSize = 1 }
	if ($parsedPageSize -gt $MaxPageSize) { $parsedPageSize = $MaxPageSize }

	[pscustomobject]@{
		IsValid  = $true
		Errors   = @()
		Page     = $parsedPage
		PageSize = $parsedPageSize
		Offset   = ($parsedPage - 1) * $parsedPageSize
	}
}
