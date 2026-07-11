# md-toc

A minimal, single-purpose Command Line Interface (CLI) built with Bun and TypeScript to parse Markdown files, generate GitHub-compatible Table of Contents (TOC), and inject it into designated marker tags.

**Goal:** To automatically maintain an accurate table of contents in long Markdown documents without requiring a running web server or database.

## ✨ Features

*   **Heading Detection:** Parses ATX headings (`#` through `######`) using regex, ignoring content inside fenced code blocks.
*   **Slug Generation:** Converts heading text into GitHub-compatible anchor links (lowercase, spaces to hyphens, punctuation stripped).
*   **Duplicate Handling:** Automatically suffixes slugs for duplicate headings (e.g., "Introduction" becomes "#introduction" and "#introduction-1").
*   **Nested TOC Rendering:** Renders a Markdown bullet list structure that correctly reflects the heading hierarchy.
*   **Marker Management:** Inserts the generated TOC between specific comment markers: `<!-- toc -->` and `<!-- /toc -->`. It handles missing or partial marker setup gracefully.
*   **Read-Only Check Mode (`--check`):** Compares the current TOC content against a newly generated version without modifying the source file, ideal for CI/CD pipelines.
*   **Depth Limiting:** Supports limiting the visible depth of the TOC using the `--depth <N>` flag.

## ⚙️ Prerequisites

This tool requires:
1.  **Bun Runtime:** Recommended for package management and execution (`bun install`, `bun run`).
2.  **TypeScript:** For development, although the end-user only interacts with Bun/CLI.
3.  **Node.js Environment:** A standard Node.js environment (or bun) is required to execute the CLI.

## 🚀 Setup Instructions

1.  **Clone the repository:**
    ```bash
    git clone <repository-url> md-toc
    cd md-toc
    ```

2.  **Install Dependencies:**
    Use `bun` for fast installation:
    ```bash
    bun install
    ```

3.  **Build (Optional but Recommended):**
    Compile the TypeScript sources into distributable JavaScript in the `dist/` folder.
    ```bash
    bun run build:tsc 
    # Note: The 'build' script must be configured in package.json to run the compilation step.
    ```

## 💡 Running the Application (Usage)

The core functionality is exposed via a single command, processing one or more Markdown files.

**Basic Usage:** Process all headings and inject TOC into every file listed.
```bash
bunx ./.bin/cli <path/to/file1.md> <path/to/other-doc.md> 
```

**Checking for Stale TOC (CI/CD):** Run in dry-run mode to check if the TOC needs updating without touching the files.
```bash
bunx ./.bin/cli --check <path/to/file1.md>
# Exits 0 if current TOC is up to date; exits 1 and prints a diff hint if stale.
```

**Limiting Depth:** Generate a TOC, but only showing headings down to level 3.
```bash
bunx ./.bin/cli --depth 3 <path/to/file1.md>
```

## 📂 Project Structure Overview

*   `src/`: Contains all primary source code modules.
    *   `parser.ts`: Handles raw markdown parsing and heading detection.
    *   `renderer.ts`: Formats the final Markdown list structure.
    *   `cli.ts`: The main entry point, orchestrates file reading, processing, and writing.
    *   `slugger.ts`: Logic for converting text to slugs and handling uniqueness/casing.
*   `types/common/`: Shared TypeScript definitions (e.g., `Heading`).
*   `tests/unit/`: Unit tests covering isolated logic components (parser, slugging).
*   `package.json`: Defines scripts (`build`, `start`) and dependencies.

## 📜 Development & Contribution Guide

1.  **Testing:** All new logic must be covered by unit tests in `tests/unit/`. The final integration gate is the **Quality Control Suite**.
2.  **Formatting:** Adhere to standard TS formatting rules. Use single quotes where appropriate for strings.
3.  **CLI Extensions:** If adding a new feature, implement it as an isolated module (e.g., `src/newFeature.ts`) and expose its function in `src/cli.ts`.

## 📚 Quality Assurance Gate

The minimum quality gate required before any PR is merged:
1.  `bun run lint` (Style check)
2.  `bun run typecheck` (Type safety check)
3.  `bun test` (Unit tests coverage, covering all features in `.aidd/features/`)
4.  (Manual Smoke Check): Run against a sample set of complex markdown files to verify correct behavior across depth and slugging edge cases.