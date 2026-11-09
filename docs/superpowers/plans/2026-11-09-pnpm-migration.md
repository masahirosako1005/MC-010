# pnpm Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve every currently resolved direct dependency version while replacing npm dependency management and current operating commands with pinned pnpm.

**Architecture:** Treat `package.json` plus `pnpm-lock.yaml` as the reproducibility boundary. Exact manifest versions prevent compatible-range drift, the pinned package-manager declaration fixes pnpm itself, and documented frozen installs reject lockfile/manifest divergence.

**Tech Stack:** Node.js 26.13.0, pnpm 11.25.0, TypeScript, React, Vite, Express

**Spec:** `docs/superpowers/specs/2026-11-09-pnpm-migration-design.md`

## Global Constraints

- Keep Node.js at `>=26 <27`; use the project-local Node.js 26.13.0 for build and restart.
- Preserve the exact direct versions already resolved by `package-lock.json`; do not resolve `latest` or upgrade dependencies.
- Do not change UI, database schema/migrations, API contracts, generation rules, or application behavior.
- Do not read, modify, or commit `Password*`, source CSV contents, user photos, local databases, or tool binaries.
- Do not run tests, check, audit, E2E, or independent review because the user did not explicitly request them.
- After edits, build, restart only this project's application on port 3001 hidden, and make one minimal HTTP availability check.

## Review Focus

- Manifest drift: every former caret range must become the exact version already recorded in the npm lockfile; verify by comparing the two manifests before removing the npm lockfile.
- Package-manager drift: `packageManager` and `engines.pnpm` must both name pnpm 11.25.0; inspect `package.json`.
- Lockfile drift: imported direct versions must match the exact manifest without package upgrades; inspect `pnpm-lock.yaml` and run a frozen lockfile-only install.
- Stale operational commands: current setup/development/import commands must use pnpm, while historical evidence must stay historically accurate; search first-party non-vendor files.
- Runtime interruption: stop only the process listening on port 3001 that is identified as this project, leave PostgreSQL and other applications running, then confirm one HTTP response.

---

### Task 1: Pin the package manager and dependency graph

**Files:**
- Create: `.npmrc`
- Create: `pnpm-lock.yaml`
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`
- Delete: `package-lock.json`

**Interfaces:**
- Consumes: exact direct versions in the npm lockfile and pnpm 11.25.0 available on this workstation.
- Produces: an exact `package.json`, pinned pnpm declaration, and frozen `pnpm-lock.yaml` used by all later commands.

- [x] **Step 1: Record the exact package-manager policy**

Add `packageManager: "pnpm@11.25.0"`, `engines.pnpm: "11.25.0"`, replace every caret dependency with its npm-lock resolved version, add `.npmrc` entries `save-exact=true` and `prefer-frozen-lockfile=true`, and allow only `esbuild@0.28.2` in `pnpm-workspace.yaml` when dependency build scripts are enabled.

- [x] **Step 2: Import the npm lockfile without upgrades**

Run with project-local Node.js 26.13.0: `pnpm import`.

Expected: `pnpm-lock.yaml` is created from `package-lock.json`, and all direct specifiers equal the exact manifest values.

- [x] **Step 3: Remove the obsolete npm lockfile**

Delete only `package-lock.json` after the pnpm lockfile has been inspected.

- [x] **Step 4: Verify frozen lockfile consistency without installing or upgrading packages**

Run: `pnpm install --lockfile-only --offline --frozen-lockfile --ignore-scripts`

Expected: exit code 0 and no lockfile changes.

### Task 2: Update current project documentation

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/technology.md`
- Modify: `docs/data-import.md`
- Modify: `docs/verification.md`

**Interfaces:**
- Consumes: the pinned commands and lockfile from Task 1.
- Produces: current setup, operation, import, and verification instructions that consistently use pnpm while retaining historical npm evidence.

- [x] **Step 1: Replace current operational npm commands**

Use `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm run <script>`, `pnpm test`, `pnpm exec playwright`, and `pnpm audit` in current instructions and project rules.

- [x] **Step 2: Preserve historical evidence and add migration evidence boundaries**

Do not relabel old npm runs. Add a 2026-11-09 migration entry stating that only pnpm lock consistency, build, restart, and HTTP availability were checked; tests/check/audit/E2E/review remain unexecuted for this change.

- [x] **Step 3: Search for stale first-party npm commands**

Run an `rg` search excluding `.agents`, `.skill-sources`, `.tools`, historical plans/specs, and `node_modules`.

Expected: remaining npm mentions are explicitly historical or external ecosystem references, not current project commands.

### Task 3: Build, activate, and commit the migration

**Files:**
- Modify: generated `dist/**` only as an untracked/ignored build output; do not stage it.
- Stage: only the migration configuration (including `pnpm-workspace.yaml`), lockfile, approved design, plan, and documentation files.

**Interfaces:**
- Consumes: the frozen pnpm graph and updated operating instructions from Tasks 1–2.
- Produces: a built and running port-3001 application plus a focused Git commit without secrets or runtime data.

- [x] **Step 1: Build with the pinned package manager**

Run with Node.js 26.13.0: `pnpm run build`.

Expected: exit code 0 and server/client build output generated.

- [x] **Step 2: Identify and restart only this project's port-3001 process**

Resolve the listening PID, inspect its command line and working/project path, stop it only if it is this app, then use `Start-Process -WindowStyle Hidden` with project-local Node.js 26.13.0 and `pnpm start` from this workspace. Do not stop PostgreSQL or any other application.

- [x] **Step 3: Confirm minimal availability**

Request `http://127.0.0.1:3001/` once.

Expected: an HTTP success response from the rebuilt app.

- [x] **Step 4: Inspect and commit only intended files**

Run `git status --short`, `git diff --check`, inspect the staged file list, and ensure it excludes secrets, source CSVs, user photos, local DBs, runtime artifacts, and tool binaries.

Commit message: `chore: migrate dependency management to pnpm`

- [x] **Step 5: Report the verification boundary**

Report build, restart, HTTP result, and commit hash. Explicitly state that tests, check, audit, E2E, data verification, and independent review were not run.
