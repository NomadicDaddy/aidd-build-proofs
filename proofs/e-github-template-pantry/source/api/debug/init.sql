-- Debug reset + seed: drop, recreate the pantry items table, and load a small handful of
-- realistic sample rows (including a low-stock and an expiring/expired item) so every view has
-- content. Schema MUST stay in sync with Initialize-PantryStore in api/_lib/pantry-store.ps1 —
-- the DAL is the single source of truth for the pantry `items` model. For a full ~20-item
-- dataset use the dedicated seed script; this route is a quick debug convenience.
DROP TABLE IF EXISTS "items";

CREATE TABLE "items" (
	"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"name" TEXT NOT NULL,
	"category" TEXT,
	"quantity" REAL NOT NULL DEFAULT 0 CHECK ("quantity" >= 0),
	"unit" TEXT,
	"expiry" TEXT,
	"threshold" REAL NOT NULL DEFAULT 1,
	"notes" TEXT,
	"created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
	"updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
);

INSERT INTO
	"items" (
		"name",
		"category",
		"quantity",
		"unit",
		"expiry",
		"threshold",
		"notes"
	)
VALUES
	(
		'Olive oil',
		'Oils',
		2,
		'bottles',
		date('now', '+180 day'),
		1,
		NULL
	),
	('Rice', 'Grains', 5, 'kg', NULL, 2, 'Long grain'),
	(
		'Milk',
		'Dairy',
		1,
		'carton',
		date('now', '+3 day'),
		2,
		NULL
	),
	(
		'Canned beans',
		'Canned',
		8,
		'cans',
		date('now', '+365 day'),
		3,
		NULL
	),
	(
		'Yogurt',
		'Dairy',
		0,
		'cups',
		date('now', '-2 day'),
		1,
		'Finish soon'
	),
	('Flour', 'Baking', 3, 'kg', NULL, 1, NULL),
	(
		'Eggs',
		'Dairy',
		6,
		'count',
		date('now', '+10 day'),
		6,
		NULL
	),
	('Pasta', 'Grains', 4, 'boxes', NULL, 2, NULL);
