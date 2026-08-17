# Work Tools Local Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Next.js utility website with a macOS-first Wails desktop application that preserves Text Diff, JSON Visualizer, and Base64 to PDF and persists local workspace data in SQLite.

**Architecture:** A React/TypeScript/Vite SPA runs inside Wails/WKWebView. Pure TypeScript tool logic is migrated with parity tests; Go owns SQLite, native dialogs, file writes, application lifecycle, and macOS integration through generated Wails bindings.

**Tech Stack:** Wails v3.0.0-beta.9, Go 1.26.3, macOS 13+ arm64, React 19.2.7, TypeScript 5.9.3, Vite 8.0.5, pnpm 11.8.0, Tailwind CSS 4.3.1, Zustand 5.0.14, modernc.org/sqlite v1.54.0, Vitest 4.1.10, Playwright 1.62.x, and GitHub Actions/gh-stack.

**Spec:** `docs/superpowers/specs/2026-08-16-work-tools-local-migration-design.md`

## Global Constraints

- Product name is `Work Tools`; bundle identifier is `com.brxyxn.worktools`.
- Target only Apple Silicon and macOS 13+ in v0.1.0.
- Pin Wails v3.0.0-beta.9 and every dependency; never use `latest` in tracked manifests.
- Preserve all current behavior of Text Diff, JSON Visualizer, and Base64 to PDF.
- JSON remains generic; custom detection enriches the view but never gates valid JSON.
- Keep Base64/PDF data ephemeral and behaviorally unchanged.
- Start with a fresh SQLite database; do not import browser localStorage.
- Do not add unimplemented tools, telemetry, cloud services, or remote assets.
- The first internal package is unsigned; signing, notarization, and auto-update are deferred.

---

## Preflight

- [ ] Reauthenticate GitHub with `gh auth login -h github.com` and verify with
  `gh auth status`.
- [ ] Run `wails3 doctor` in the normal terminal and resolve every reported
  macOS dependency failure.
- [ ] Configure non-interactive stack behavior:

  ```bash
  git config rerere.enabled true
  git config remote.pushDefault origin
  ```

- [ ] Confirm `git status --short` is clean before initializing the stack.

## Stack Layout

Create branches strictly in this dependency order:

```text
master
└── migration/01-wails-foundation
    └── migration/02-local-persistence
        └── migration/03-base64-pdf
            └── migration/04-text-diff
                └── migration/05-json-data
                    └── migration/06-json-visualizer
                        └── migration/07-macos-polish
                            └── migration/08-release
```

Initialize only the first branch before implementation:

```bash
gh stack init --base master migration/01-wails-foundation
```

After a layer is implemented, verified, and committed, create the next branch
with the explicit `gh stack add <branch>` command shown below. Publish drafts
non-interactively with `gh stack submit --auto --remote origin` and inspect
them with `gh stack view --json`.

### PR 1: Wails foundation

**Branch:** `migration/01-wails-foundation`

**Primary files:** Wails entry point and build configuration; `frontend/package.json`; Vite, TypeScript, Tailwind, lint, and test configuration; `frontend/src/app`; focused shared UI components.

**Produces:** A pinned Wails/React/Vite shell, typed frontend test harness, three-tool registry, and baseline CI commands.

- [x] Scaffold the official Wails v3 React/TypeScript template through a
  temporary directory so the existing Git repository is not overwritten.
- [x] Pin Wails beta.9, Go 1.26.3, Node/pnpm, React 19, TypeScript, Vite,
  Tailwind, testing dependencies, and the exact Wails runtime version.
- [x] Remove generated greeting code, sample assets, mobile builds, and
  non-macOS packaging tasks.
- [x] Create the React shell, sidebar, command menu, theme provider, error
  boundary, and tool registry containing only the three implemented tools.
- [x] Port only shared UI primitives required by the migrated screens.
- [x] Add ESLint, `tsc --noEmit`, Vitest, frontend production build, gofmt,
  `go vet`, and `go test ./...` scripts.
- [x] Verify `wails3 task dev` opens the shell and `wails3 build GOOS=darwin
  GOARCH=arm64` produces an application bundle.
- [x] Commit the cohesive foundation changes, then run:

  ```bash
  gh stack add migration/02-local-persistence
  ```

### PR 2: Local persistence and service boundary

**Branch:** `migration/02-local-persistence`

**Primary files:** `internal/storage`, embedded migrations, `internal/services`, generated Wails bindings, and frontend service adapters.

**Produces:** `PayloadService`, `WorkspaceService`, database repositories, startup hydration, and mockable frontend ports.

- [ ] Write failing Go tests for first-run creation, schema versioning,
  transactions, reopen persistence, migration rollback, foreign keys, and a
  corrupt database.
- [ ] Implement the Application Support database path, connection pragmas,
  migration runner, integrity handling, and future pre-migration backup hook.
- [ ] Add migrations for payloads, ordered tags, Text Diff draft, settings,
  indexes, JSON validity constraints, and cascade behavior.
- [ ] Implement database-first payload CRUD, batch transactions, selection,
  restore, Text Diff draft storage, and settings storage.
- [ ] Register the Wails services and generate checked-in TypeScript bindings.
- [ ] Add frontend adapters and in-memory test doubles; implement loading,
  mutation-error toasts, and the fatal database recovery screen.
- [ ] Run `go test -race ./...`, `go vet ./...`, frontend tests, and the Wails
  arm64 build.
- [ ] Commit the persistence layer, then run:

  ```bash
  gh stack add migration/03-base64-pdf
  ```

### PR 3: Base64 to PDF risk slice

**Branch:** `migration/03-base64-pdf`

**Primary files:** `frontend/src/features/base64-pdf` and native file service methods.

**Consumes:** `FileService` binding and the shared shell.

**Produces:** The unchanged Base64-to-PDF workflow using native dialogs.

- [ ] Port the existing decoding and PDF magic-byte validation with tests for
  whitespace, empty input, malformed Base64, non-PDF data, and Unicode text
  accidentally supplied as input.
- [ ] Port the existing UI, shortcuts, toasts, Blob lifecycle, PdfSlick
  preview, clipboard paste, clear, and memory cleanup behavior.
- [ ] Implement native `.txt` open and PDF save dialogs. Revalidate decoded
  bytes in Go before writing and return cancellation without an error toast.
- [ ] Bundle the PDF.js worker inside the application and verify that no
  network request is made.
- [ ] Test single-page and multipage fixtures in development and in the
  packaged WKWebView app. If PdfSlick cannot render under the Wails scheme,
  replace only the preview component with WKWebView's native PDF frame in this
  PR; do not ship without preview.
- [ ] Verify the saved PDF bytes equal the decoded fixture exactly and that no
  Base64 or PDF state appears in SQLite after relaunch.
- [ ] Commit the complete vertical slice, then run:

  ```bash
  gh stack add migration/04-text-diff
  ```

### PR 4: Text Diff parity and drafts

**Branch:** `migration/04-text-diff`

**Primary files:** `frontend/src/features/text-diff` and WorkspaceService draft integration.

**Produces:** Feature-parity Text Diff with SQLite draft restoration.

- [ ] Port the pure line/word diff and textarea line-editing helpers before
  porting the UI.
- [ ] Add fixtures for empty, identical, added, removed, modified, trailing
  newline, whitespace-only, Unicode, unequal block, and multiline-selection
  cases.
- [ ] Port split/unified views, stats, line numbers, highlights, swap, clear,
  empty state, and identical state.
- [ ] Preserve `Option+Shift+Up/Down` line movement and `Command+Delete` line
  deletion with selection restoration tests.
- [ ] Debounce draft writes and flush on blur or tool switch; restore both
  inputs and view mode after relaunch.
- [ ] Run the full frontend, Go, and arm64 build checks.
- [ ] Commit Text Diff, then run:

  ```bash
  gh stack add migration/05-json-data
  ```

### PR 5: Generic JSON data and detection rules

**Branch:** `migration/05-json-data`

**Primary files:** `frontend/src/features/json-visualizer/model`, payload store adapter, and payload repository integration.

**Produces:** Schema-agnostic parsing/search/transformation plus persistent payload CRUD.

- [ ] Port `JsonValue`, minification, humanized keys, empty detection, search,
  tag normalization, batch parsing, identifier detection, metadata detection,
  and immutable nested array reordering.
- [ ] Represent metadata/identifier aliases as data-driven detector rules.
  Preserve current quote-related and envelope heuristics while making the
  generic JSON tree independent from every detector.
- [ ] Add fixtures for arbitrary objects, arrays, scalar roots, unknown custom
  fields, direct payloads, envelope objects, object payload values, JSON-string
  payloads, multiple escaping levels, and mixed batches.
- [ ] Verify custom/unknown fields are never dropped, hidden, rejected, or
  rewritten by detection.
- [ ] Add tests for case/separator variations, exact/prefixed `created_at`,
  missing metadata, invalid batches, all-or-nothing insert, tag deduplication,
  update, delete, restore, selection, and restart.
- [ ] Implement the asynchronous Zustand store over Wails adapters without
  browser persistence middleware.
- [ ] Commit the generic JSON foundation, then run:

  ```bash
  gh stack add migration/06-json-visualizer
  ```

### PR 6: JSON Visualizer interface parity

**Branch:** `migration/06-json-visualizer`

**Primary files:** `frontend/src/features/json-visualizer/components`.

**Consumes:** Generic JSON helpers, payload store, and persistent services.

**Produces:** The complete JSON Visualizer user interface.

- [ ] Port add-payload sheet, clipboard handling, metadata preview, optional
  name, tags, single add, and batch add.
- [ ] Port the payload list with master grouping, quote request subgrouping,
  newest-first ordering, ungrouped-last placement, metadata, identifiers, and
  tags.
- [ ] Port the recursive JSON tree, humanized labels, generic scalar rendering,
  free-text/`field:value` search, hide-empty filter, and nested array drag.
- [ ] Port valid-only JSON editing and persist canonical results.
- [ ] Port individual delete, grouped delete, clear-all confirmation, and undo
  restoration through SQLite.
- [ ] Make edit/delete actions available on focus as well as hover and add
  keyboard/VoiceOver labels.
- [ ] Add interaction tests for add, mixed batch, selection, search, filtering,
  edit, reorder, delete, group delete, undo, clear, and relaunch.
- [ ] Commit the completed feature, then run:

  ```bash
  gh stack add migration/07-macos-polish
  ```

### PR 7: macOS integration and polish

**Branch:** `migration/07-macos-polish`

**Primary files:** Wails window/menu configuration, application assets, and shared frontend shell.

**Produces:** A macOS-native application shell and finalized branding.

- [ ] Configure `Work Tools`, `com.brxyxn.worktools`, macOS 13 minimum,
  arm64, initial/minimum window sizes, appearance, and About metadata.
- [ ] Add standard Application, Edit, View, Window, and Help menus.
- [ ] Add `Command+K`, `Command+1/2/3`, and context-sensitive
  `Command+O`/`Command+S` shortcuts without conflicting with text editing.
- [ ] Follow system appearance, persist an explicit override, and verify
  light/dark contrast and reduced motion.
- [ ] Replace browser-oriented wording with local desktop wording while
  leaving tool behavior unchanged.
- [ ] Generate final macOS icon assets from the approved 1024px source icon.
- [ ] Run keyboard-only, VoiceOver-label, focus, resize, and visual smoke tests.
- [ ] Commit macOS polish, then run:

  ```bash
  gh stack add migration/08-release
  ```

### PR 8: Parity gates and internal release

**Branch:** `migration/08-release`

**Primary files:** GitHub Actions workflows, Playwright suites, release scripts, and operator documentation.

**Produces:** Reproducible checks and unsigned v0.1.0 arm64 artifacts.

- [ ] Add pull-request CI for locked pnpm install, lint, typecheck, Vitest,
  Playwright WebKit, frontend build, gofmt check, vet, Go race tests, and Wails
  arm64 compilation.
- [ ] Add tag-triggered packaging for unsigned `.app` and `.dmg` artifacts and
  SHA-256 checksums.
- [ ] Document first-launch Gatekeeper steps, database/log locations, backup
  behavior, troubleshooting, and full local verification commands.
- [ ] Execute the Text Diff, generic/custom JSON, Base64/PDF, persistence,
  offline, dark/light, and packaged-app acceptance matrices on a clean Mac.
- [ ] Confirm navigation and command search contain exactly three tools.
- [ ] Confirm the existing web app remains untouched and available during the
  internal desktop rollout.
- [ ] Commit release automation and submit/update drafts non-interactively:

  ```bash
  gh stack submit --auto --remote origin
  gh stack view --json
  ```

## Stack Review and Merge Rules

- Publish each completed layer with `gh stack submit --auto --remote origin`.
- Keep unfinished upper layers as drafts; use `--open` only when all checks and
  parity gates for the submitted branches are satisfied.
- Put review fixes on the branch that owns the concern. After changing a lower
  branch, run `gh stack rebase --upstack` and then
  `gh stack submit --auto --remote origin`.
- Synchronize remote/trunk changes with
  `gh stack sync --remote origin`; never edit generated parent/base relations
  manually on GitHub.
- Inspect stack state only with `gh stack view --json` in agent sessions.
- After every PR is approved, open, and green, merge atomically with:

  ```bash
  gh stack merge --yes --squash
  ```

## Final Acceptance Matrix

- **Text Diff:** exact fixtures, split/unified, stats, shortcuts, draft restore.
- **JSON:** arbitrary valid JSON, current envelopes and identifiers, unknown
  custom fields, batch parsing, grouping, filters, editing, reordering,
  persistence, delete/undo, relaunch.
- **Base64/PDF:** current decode errors, clipboard, `.txt`, preview, clear,
  byte-identical save, offline packaged app, no persistence.
- **Storage:** first run, reopen, atomic batch, migration rollback, corrupt DB,
  backup hook, Application Support location.
- **macOS:** arm64/macOS 13+, native menus/dialogs, keyboard, appearance,
  resizing, unsigned DMG first-launch documentation.
- **Scope:** exactly three tools; no placeholder tools, web server, cloud,
  telemetry, signing, auto-update, or cross-platform artifacts.
