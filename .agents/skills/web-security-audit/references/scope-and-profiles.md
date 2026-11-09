# Scope and Profile Contract

## Preflight Record

Record these facts before audit inspection. If a required fact is unknown, stop at `preflight` with `incomplete` and name the owner of the decision.

| Field | Required content |
|---|---|
| `repository` | Local repository identifier; do not expose a user home path in a shared report. |
| `source_ref` | Commit SHA or supplied snapshot identifier. Record dirty state separately; never imply uncommitted content is represented by the SHA. |
| `profile` | Exactly `preflight`, `source`, or `full`. |
| `authorization_boundary` | The repository/snapshot and local operations the user authorized. |
| `scope_paths` | Included application, data-flow, configuration, and documentation paths. |
| `excluded_paths` | Secrets, real data, generated output, vendor, infrastructure, and other exclusions. |
| `requested_components` | `ipa-checklist`, `cloudflare-source`, or both. `full` means the Cloudflare component follows its complete full-audit workflow. |
| `output_dir` | A new or designated audit-output directory that does not expose reports to the public application. |
| `execution_capability` | `source-only` or the exact available OS-enforced sandbox controls. |
| `known_blockers` | Missing source, configuration, sandbox, identity, deployment, or budget facts. |

## Generic Source Scope

Include only what is needed to trace application trust boundaries:

- request handlers, middleware, client rendering, shared validation and types;
- authentication, session, authorization, ownership, role, and sharing logic;
- database queries, migrations, storage, file/path, image/document, import/export, and generated-artifact flows;
- mail, response-header, redirect, proxy, CORS, security-header, and error/logging construction;
- package manifests and the current lockfile(s), build/runtime configuration, and relevant deployment documentation;
- native modules, binary parsers, decoders, FFI, converters, and transitive boundaries discoverable from source and manifests.

Exclude unless the user explicitly and safely expands scope:

- secrets, credential stores, `.env*`, `Password*`, tokens, certificates, and ambient environment values;
- source CSV, database contents, logs containing real values, uploads, user photos, production backups, and real personal data;
- dependency directories, build output, caches, generated artifacts, tool binaries, and vendored skill source;
- live endpoints, external services, shared databases, real identities, production infrastructure, and availability testing;
- Cloudflare account, WAF, DNS, CDN, Workers, dashboard, API token, and edge-rule configuration.

## MC-010 Safe Defaults

For this repository, start with these read-only source paths when they exist:

- `src/client`, `src/server`, and `src/shared`;
- `db/migrations` and database schema/query code, without opening a database containing user data;
- `package.json`, the current lockfile(s), workspace/package-manager configuration, TypeScript/build configuration, and application-relevant scripts;
- `README.md`, `docs/spec.md`, `docs/design.md`, `docs/security.md`, and other documents needed to resolve an exact security assumption.

Default exclusions are:

- `node_modules`, `dist`, coverage/test output, caches, `.local`, `.tools`, `.skill-sources`, and unrelated `.agents/skills` vendor content;
- `Password*`, `.env*`, source CSV under `C:/AI-Sprint/sample-data`, databases with user data, real names/emails/free responses, uploads, user photos, and generated brochures/images;
- any live service on port 3001, shared PostgreSQL instance, external AI/service API, or Cloudflare control plane.

Use schemas and code paths instead of real records. Do not copy absolute workstation paths into distributable evidence; use repository-relative paths.

## Profile Execution

### `preflight`

- Resolve the preflight record and report template/output location.
- Do not inspect sensitive content and do not run target-controlled code.
- Status is `complete` only for the requested preflight phase when every required record field is fixed. It is not an assertion that an audit ran.

### `source`

- Create every `IPA-1.1` through `IPA-1.11` row and each applicable supplemental row.
- Perform Cloudflare source review under the vendored skill's guidance-mode evidence rules.
- Do not run the application, tests, parsers, browser, fixtures, or build merely to improve confidence.
- Runtime/deployment facts not provable from source become `要確認`; an in-scope source area that cannot be inspected becomes `未実施`.
- `ipa-checklist` is complete when every fixed row and applicable supplemental row has a supported result, reason, evidence, and gap/next step where needed.
- `cloudflare-source` is complete when the declared source scope and trust boundaries were traced and each surfaced candidate is either supported to the source-profile evidence bar or explicitly classified `要確認`. Missing in-scope source makes it incomplete.

### `full`

- Follow all phases, artifacts, ledgers, independent candidate validation, validators, budgets, and terminal-state rules in `security-audit`.
- For this project, do not mark a Cloudflare full audit complete unless the required OS-enforced sandbox capability is present and recorded, even when the final evidence is source-based.
- Target-controlled code receives only dummy fixtures and an empty/allowlisted environment inside the sandbox. Never install or fetch dependencies.
- If the sandbox, source visibility, validation budget, or another required control is missing, preserve completed source work and set the Cloudflare component and overall run to `incomplete` with the exact reason.

## Component and Overall Status

Use component IDs exactly:

| Component | Meaning |
|---|---|
| `ipa-checklist` | IPA 11-category coverage plus separately labelled supplemental checks. |
| `cloudflare-source` | Trust-boundary/source methodology from the vendored Cloudflare `security-audit` skill; it is not a Cloudflare account audit. |

Each requested component is `complete` or `incomplete`. An unrequested component is `not-requested` and contributes no audit items or counts.

Overall status is `complete` only when every requested component satisfies the selected profile's completion rule. Otherwise it is `incomplete`, and `incomplete_reason` lists each blocking component and exact reason. `OK`, `NG`, `要確認`, `未実施`, and `対象外` remain item results; do not derive overall completion merely from their counts.

