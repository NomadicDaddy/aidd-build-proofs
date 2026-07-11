# md-toc — Markdown table-of-contents CLI

A single-purpose command-line tool, TypeScript on Bun, that generates and updates a table of
contents inside Markdown files. No server, no UI, no database — just the CLI and its tests. Keep
the design small: a parser module, a TOC renderer module, and a thin CLI entry point.

## Core features

1. **Heading parser.** Parse ATX headings (`#` through `######`) from a Markdown file. Ignore
   headings inside fenced code blocks. Capture level and text.
2. **Anchor slugs (GitHub style).** Convert heading text to GitHub-compatible anchor links:
   lowercase, spaces to hyphens, punctuation stripped, inline code/backticks and markdown
   formatting removed from the slug, duplicate headings suffixed `-1`, `-2`, …
3. **TOC rendering.** Render a nested bullet-list TOC from the parsed headings, indented by
   heading level, each entry a `[text](#slug)` link. A `--depth <n>` flag limits how deep the TOC
   goes (default 3).
4. **Marker insert/replace.** Insert the TOC between `<!-- toc -->` and `<!-- /toc -->` markers in
   the file, replacing any existing content between them. If only the opening marker exists, add
   the closing one. If no markers exist, print a clear error and exit non-zero (do not guess a
   location). Preserve the rest of the file byte-for-byte.
5. **Check mode.** `--check` compares the current TOC block to what would be generated: exit 0 if
   up to date, exit 1 with a short diff-style message if stale, without writing. This is the CI
   entry point.
6. **Multiple files.** Accept one or more file paths as arguments and process each; a non-zero
   exit if any file fails (or is stale in `--check` mode). Report per-file results.

## Quality bar

- Unit tests (`bun test`) covering: fenced-code-block exclusion, slug edge cases (punctuation,
  emoji, inline code, duplicates), depth limiting, marker replace idempotency (running twice
  changes nothing), check-mode exit codes, and missing-marker error.
- `--help` output documenting flags; clean error messages for missing files.
- No dependencies beyond what the scaffold already provides (write the Markdown parsing by hand —
  it's line-based and small; do not add a Markdown library).
