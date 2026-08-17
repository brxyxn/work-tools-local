# Work Tools

A local-first macOS desktop application for Text Diff, JSON visualization, and
Base64-to-PDF conversion. This repository is the Wails migration target for
`work-tools-web`.

## Requirements

- macOS 13 or newer on Apple Silicon
- Go 1.26.3
- Wails CLI 3.0.0-beta.9
- Node.js 22.21.x
- pnpm 11.8.0

Run the development app with `wails3 dev`. Run frontend checks from
`frontend/` with `pnpm lint`, `pnpm typecheck`, and `pnpm test`. Build the
arm64 application with `wails3 build` and package it with
`wails3 task package`.

The complete architecture, pinned technology stack, feature parity rules, and
stacked-PR sequence are documented in
`docs/superpowers/specs/2026-08-16-work-tools-local-migration-design.md` and
`docs/superpowers/plans/2026-08-16-work-tools-local-migration.md`.
