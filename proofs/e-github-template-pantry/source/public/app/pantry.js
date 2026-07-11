// Pantry client behaviours. Extracted from an inline <script> in views/layouts/main.pode so the
// Content-Security-Policy can keep `script-src 'self'` (no 'unsafe-inline' for scripts) — see the
// Set-PodeSecurityContentSecurityPolicy call in podex.ps1. Loaded via <script src="/public/app/pantry.js">.
// Lives under public/app (version-controlled), not public/js — that dir is gitignored build output for
// vendor libs (htmx, mustache) copied in by .build.ps1.

// Server-side validation failures return HTTP 422 with the re-rendered form/row fragment (name
// required, quantity >= 0, valid date, etc.). htmx 2 does not swap non-2xx responses by default, so
// treat 422 as a swappable, non-error response so the validation errors render in place instead of
// being dropped.
document.body.addEventListener('htmx:beforeSwap', function (event) {
	if (event.detail.xhr && event.detail.xhr.status === 422) {
		event.detail.shouldSwap = true;
		event.detail.isError = false;
	}
});

// Keep keyboard focus sensible across item-row swaps so it is never dropped to the top of the
// document. htmx already restores focus to a control whose id survives the swap (the +/- quick-adjust
// buttons carry stable ids), so this only needs to cover the cases it cannot: an edit form swapping in
// (focus the first field), and a read-only row whose focused control disappeared (e.g. the "-" button
// becoming disabled at quantity 0, or Save/Cancel returning the row) — move focus to a still-usable
// control in that row.
document.body.addEventListener('htmx:afterSettle', function (event) {
	var row = event.detail.target;
	if (!row || !row.id || row.id.indexOf('item-row-') !== 0) {
		return;
	}
	var firstField = row.querySelector('form input:not([type=hidden]), form select, form textarea');
	if (firstField) {
		firstField.focus();
		return;
	}
	if (document.activeElement === document.body || !document.activeElement) {
		var control = row.querySelector('button:not([disabled])');
		if (control) {
			control.focus();
		}
	}
});
