# Work Tools Local Migration Design

## Summary

Migrate the existing `work-tools-web` Next.js application into a local-first,
Apple-Silicon Wails desktop application in `work-tools-local`. The desktop app
must preserve the full behavior of Text Diff, JSON Visualizer, and Base64 to
PDF, while replacing browser persistence with SQLite and removing every
unimplemented tool entry.

The target is `Work Tools`, bundle identifier `com.brxyxn.worktools`, macOS
13+, arm64. The first internal release is unsigned. Code signing,
notarization, automatic updates, Intel, Windows, and Linux builds are outside
the first release.

## Architecture

- Use Wails v3.0.0-beta.9 with a React/TypeScript/Vite frontend rendered by
  WKWebView. Do not carry Next.js, SSR, React Server Components, or App Router
  into the desktop application.
- Preserve the existing pure TypeScript diff and JSON algorithms. Go owns
  SQLite, application lifecycle, native file dialogs, file writes, and macOS
  integration.
- Communicate through generated, checked-in Wails TypeScript bindings. Keep a
  frontend adapter boundary so component tests can use in-memory service
  doubles without launching Wails.
- Keep the application offline. Do not add a local HTTP API, telemetry, cloud
  persistence, or CDN-hosted assets.

## Technology Stack

### Runtime and build

- macOS 13+, Apple Silicon only
- Wails v3.0.0-beta.9
- Go 1.26.3
- WKWebView
- Node.js 22.21.0
- pnpm 11.8.0
- Vite 8.0.5 and `@vitejs/plugin-react` 6.x
- TypeScript 5.9.3

### Frontend

- React and React DOM 19.2.7
- Tailwind CSS 4.3.1 with `@tailwindcss/vite`
- Selective shadcn component source, Base UI/Radix UI, and Tabler Icons
- Zustand 5.0.14 without its localStorage persistence middleware
- `diff` 9.0.0
- dnd-kit core 6.3.1, modifiers 9.0.0, sortable 10.0.0, utilities 3.2.2
- `@pdfslick/react` 4.0.0 with its PDF.js worker bundled locally
- Sonner 2.0.7, cmdk 1.1.1, date-fns 4.4.0, and
  react-resizable-panels 4.11.2 where used by migrated screens

Only copy shared UI components used by the three implemented tools. Do not
copy unused calendar, chart, carousel, OTP, or placeholder-tool UI.

### Go and data

- Go `database/sql`
- `modernc.org/sqlite` v1.54.0, embedded and CGO-free
- `github.com/google/uuid` v1.6.0
- Embedded SQL migrations with `go:embed`
- Standard-library `log/slog`

The installed `sqlite3` CLI is optional developer tooling. The application
must never require or execute it.

### Quality and delivery

- Go `testing`, `go test -race`, `go vet`, and gofmt
- Vitest 4.1.10, Testing Library, user-event, and jsdom
- Playwright 1.62.x, including WebKit browser coverage
- ESLint 9 and `tsc --noEmit`
- GitHub Actions for checks, arm64 Wails builds, unsigned `.app`/`.dmg`
  packaging, and SHA-256 checksums
- GitHub `gh stack` extension for dependent pull requests

Every dependency must be exact in `go.mod` or `pnpm-lock.yaml`. Replace the
Wails template's `@wailsio/runtime: latest` declaration with the exact version
resolved for Wails beta.9.

## Persistence

Store the database at:

```text
~/Library/Application Support/Work Tools/work-tools.db
```

Open it with foreign keys enabled, WAL journal mode, `synchronous=NORMAL`, a
five-second busy timeout, and one serialized writer. Apply embedded migrations
inside transactions. Before any future upgrade of a non-empty schema, create
a timestamped backup. If startup integrity or migration checks fail, keep the
database untouched and show a recovery screen containing the database and log
paths.

The initial schema contains:

- `schema_migrations(version, applied_at)`
- `payloads(id, name, json, created_at_unix_ms, source_system, payload_type,
  queue_uri, payload_created_at)`
- `payload_tags(payload_id, position, tag)` with cascading deletion
- `text_diff_draft(id, original_text, changed_text, view_mode, updated_at)`
- `app_settings(key, value_json)`

Persist JSON payloads, metadata, tags, selected payload, selected tool, theme
and display preferences, and Text Diff drafts. Keep Base64 text, decoded PDF
bytes, Blob URLs, clipboard contents, and temporary paths memory-only. Start
with a fresh database; do not import browser localStorage.

## Feature Requirements

### Text Diff

Preserve line alignment, intra-line word highlighting, split and unified
views, line numbers, addition/deletion totals, swap, clear, empty/identical
states, Unicode behavior, trailing-newline behavior, and the macOS line editing
shortcuts. Persist both drafts and the selected view.

### JSON Visualizer

Keep the viewer schema-agnostic. Any valid JSON value must remain viewable and
searchable without requiring a known envelope or business schema.

Preserve the existing optional heuristics:

- Direct payloads and top-level arrays
- Envelopes containing `payload`
- Object, scalar, JSON-string, and repeatedly escaped payload values
- `source_system`, `type`, `queue_uri`, exact `created_at`, and prefixed
  `*created_at` metadata detection
- Case/separator-insensitive quote request, quote response, quote completion,
  lender application, and master quote request identifier detection
- Master quote request grouping, quote request subgrouping, newest-first
  ordering, and ungrouped-last ordering
- Free-text and `field:value` search, hide-empty filtering, nested array
  reordering, payload editing, tags, deletion, group deletion, and undo

Unknown fields and custom variants must render generically in the JSON tree.
Identifier and metadata detection may enhance the custom view but must never
reject, hide, or rewrite otherwise valid JSON. Detection rules stay isolated
in data-driven TypeScript definitions so new aliases or custom fields can be
added without changing storage or core tree rendering.

### Base64 to PDF

Do not change current behavior. Preserve whitespace-tolerant decoding, invalid
Base64 errors, PDF magic-byte validation, clipboard paste, `.txt` selection,
decode, preview, clear, and download/save. Replace only the browser-specific
open/save mechanism with native macOS dialogs. Keep PDF data ephemeral and
offline.

### Application shell

Show only Text Diff, JSON Visualizer, and Base64 to PDF. Provide command-menu
and native menu shortcuts, system light/dark appearance, window-state polish,
keyboard accessibility, and VoiceOver labels. Do not show UUID Generator or
any disabled, placeholder, or “Soon” item.

## Service Interfaces

Expose typed Wails services equivalent to:

```go
type PayloadService interface {
    List() ([]Payload, error)
    CreateBatch([]NewPayload) ([]Payload, error)
    Update(PayloadUpdate) (Payload, error)
    Delete([]string) ([]Payload, error)
    Restore([]Payload) error
    Select(*string) error
}

type WorkspaceService interface {
    Load() (WorkspaceState, error)
    SaveTextDiffDraft(TextDiffDraft) error
    SaveSettings(SettingsPatch) error
}

type FileService interface {
    OpenBase64TextFile() (OpenTextResult, error)
    SaveDecodedPDF(string) (SaveResult, error)
}
```

File-dialog cancellation is a successful cancelled result. Database writes
complete before React commits the new state. Failed writes preserve the prior
visible state and display a user-facing error.

## Release Acceptance

- A clean Apple-Silicon Mac running macOS 13+ can install and open the unsigned
  internal DMG using the documented Gatekeeper flow.
- All three tools work offline and match the current web behavior.
- JSON and Text Diff state survives relaunch; Base64/PDF state does not.
- No unimplemented tool appears in navigation or the command menu.
- The packaged app passes the Go, frontend, WebKit, and manual macOS smoke
  matrices.
