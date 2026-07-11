-- Debug reset: drop and recreate an EMPTY pantry items table.
-- Schema MUST stay in sync with Initialize-PantryStore in api/_lib/pantry-store.ps1 —
-- the DAL is the single source of truth for the pantry `items` model.
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
