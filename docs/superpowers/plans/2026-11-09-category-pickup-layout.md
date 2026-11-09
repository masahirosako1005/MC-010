# Category Pickup Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the place-first route list with five persisted experience-category pickups and a responsive brochure layout.

**Architecture:** Add a shared category definition and persist an optional category on each brochure item. Generate unique category picks on the server, then render them as a five-card grid with a separate compact itinerary, memory panel, and invitation panel. Legacy brochures receive deterministic client-side category assignments until their next save.

**Tech Stack:** TypeScript, React SPA, Node.js 26, PostgreSQL, CSS

**Spec:** `docs/superpowers/specs/2026-11-09-category-pickup-layout-design.md`

## Global Constraints

- Do not read, log, or commit Password-prefixed files or secret values.
- Do not modify source CSV files or expose real names, email addresses, or free responses.
- Keep SQL parameterized and identify the user only from the session.
- Preserve one photo per spot, 200 Unicode code points per comment, and edits for removed spots.
- Do not run review or test commands because the user did not explicitly request them.
- After code changes, run the build, migrate the active local schema, restart only this project's port-3001 app hidden, and perform a minimal HTTP availability check.

## Review Focus

- A category with no eligible unused spot remains empty without fabricated data.
- A legacy brochure with no persisted categories receives stable, non-duplicated assignments.
- Individual replacement cannot choose a spot outside the active category.
- Regeneration retains photo/comment data for spots that leave or re-enter a category.
- Mobile category scrolling has button and keyboard alternatives and is not obscured by the fixed share bar.

---

### Task 1: Persisted experience category model and generator

**Files:**
- Create: `src/shared/experience-categories.ts`
- Create: `db/migrations/002_brochure_pickup_categories.sql`
- Modify: `src/shared/types.ts`
- Modify: `src/server/catalog.ts`
- Modify: `src/server/generator.ts`
- Modify: `src/server/brochures.ts`
- Modify: `src/server/validation.ts`

**Interfaces:**
- Produces: `ExperienceCategory`, `EXPERIENCE_CATEGORIES`, `spotSupportsExperienceCategory`, `assignPickupCategories`, and `selectCategoryPicks`.
- Produces: `BrochureItem.pickupCategory` and `SavePayload.items[].pickupCategory`.

- [ ] Add the shared category definitions and deterministic legacy assignment helper.
- [ ] Add the nullable `pickup_category` column and a partial unique index per brochure/category.
- [ ] Replace route selection with unique category selection while preserving deterministic scoring and candidate-shortage behavior.
- [ ] Read, validate, save, and regenerate category assignments through the existing API contract.
- [ ] Record that automated tests were not run under the repository instruction.
- [ ] Commit the domain and persistence change.

### Task 2: Category-first editor and responsive brochure

**Files:**
- Modify: `src/client/App.tsx`
- Modify: `src/client/styles.css`

**Interfaces:**
- Consumes: category definitions and persisted `pickupCategory` from Task 1.
- Produces: category cards, same-category replacement, compact model plan, and responsive navigation.

- [ ] Normalize legacy brochures when loading them into React state.
- [ ] Replace the route list with five category cards and remove add/remove-place actions.
- [ ] Move order controls into a compact model-plan panel and filter replacement choices by category.
- [ ] Convert the header to an image-backed hero and arrange the support panels for PC and mobile.
- [ ] Preserve preview/PNG exclusion behavior, photo retry, comments, keyboard controls, and 44px actions.
- [ ] Record that automated tests and independent review were not run under the repository instruction.
- [ ] Commit the UI change.

### Task 3: Specification, build, local activation, and preview

**Files:**
- Modify: `docs/spec.md`
- Modify: `docs/design.md`
- Modify: `docs/database.md`
- Modify: `docs/verification.md`

**Interfaces:**
- Consumes: final category model and UI behavior from Tasks 1–2.
- Produces: synchronized product documentation and a running port-3001 preview.

- [ ] Update product, design, and database contracts for category pickups and the reviewed `買い物` tag.
- [ ] Run `npm run build`; require exit code 0.
- [ ] Run the schema migration against the active local database.
- [ ] Identify and restart only this project's port-3001 process hidden.
- [ ] Confirm `/api/health` with the minimum HTTP request and open the editor preview in the browser.
- [ ] Update verification notes with the build/activation evidence and unrun tests/review.
- [ ] Check staged filenames and content for secrets, source CSV, uploads, databases, and unrelated changes.
- [ ] Commit documentation and activation notes.

