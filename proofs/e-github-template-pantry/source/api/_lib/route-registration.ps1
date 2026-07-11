# Route-registration gate for the file-based API auto-loader in podex.ps1.
#
# Kept as a pure, storage-free function (no $WebEvent, no Pode calls) so the "which api/*.ps1 files
# become routes, and how" decision is directly unit-testable without standing up an HTTP server.
# podex.ps1 walks ./api recursively and asks this helper what to do with each file.
#
# Two files are never registered as routes:
#   - the _lib data-access library (shared functions, not handlers), and
#   - the destructive /debug/* routes (/stop, /clear, /init) UNLESS Podex.Debug is explicitly on.
# The debug routes call Close-PodeServer (DoS) and DROP/recreate the live DB, are unauthenticated and
# GET-triggerable, so they must be ABSENT under the default (Debug off) configuration — not merely
# relocated. Returning $null tells the caller to skip Add-PodeRoute entirely for that file.

function Resolve-ApiRouteRegistration {
	[CmdletBinding()]
	param(
		# Repo-relative path to the api file, e.g. 'api/debug/stop.ps1' (either slash style accepted).
		[Parameter(Mandatory)][string]$RelativePath,
		# The Podex.Debug config flag. Debug off (the default) hides the destructive debug routes.
		# Named DebugEnabled (not Debug) so it never collides with the -Debug common parameter.
		[bool]$DebugEnabled
	)

	$rel = $RelativePath -replace '\\', '/'

	# The shared DAL/helpers under _lib define functions, not routes.
	if ($rel -match '/_lib/') { return $null }

	$isDebug = $rel -match '/debug/'

	# Gate: destructive debug routes are dev-only. Without an explicit Debug opt-in they do not exist.
	if ($isDebug -and -not $DebugEnabled) { return $null }

	$fileName = ($rel -split '/')[-1]
	$method = (Get-Culture).TextInfo.ToTitleCase($fileName) -replace '\.ps1$', ''
	$apiPath = '/' + ($rel -replace '\.ps1$', '')

	if ($method -in @('Get', 'Post', 'Put', 'Delete')) {
		# Verb-named file (get.ps1 -> GET at the parent path).
		$apiPath = $apiPath -replace "/$($method)", ''
	} elseif ($isDebug) {
		# Debug is on here (the off case returned $null above): expose as a GET, dropping the /debug segment.
		$apiPath = $apiPath -replace '/debug', ''
		$method = 'Get'
	} else {
		$method = 'Get'
	}

	return @{ Path = $apiPath; Method = $method }
}
