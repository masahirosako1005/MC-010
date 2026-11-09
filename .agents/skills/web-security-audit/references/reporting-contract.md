# Reporting Contract

## Required Outputs

Write both files to the authorized output directory:

- `REPORT.md`: portable human-readable Markdown.
- `REPORT.html`: offline, self-contained HTML suitable for browser viewing and printing.

Use [../assets/report-template.md](../assets/report-template.md) and [../assets/report-template.html](../assets/report-template.html). Both outputs must be projections of one canonical data set, not separately interpreted reports.

## Canonical Data

Maintain one ordered list of audit items. Every item contains:

| Field | Contract |
|---|---|
| `id` | Stable item ID. Use `IPA-1.1`…`IPA-1.11`, `SUP-01`…`SUP-06`, then stable Cloudflare-only IDs. |
| `frameworks` | Non-empty ordered references such as `IPA-1.11`, `SUP-03`, and `CFSA:<coverage-or-finding-id>`. |
| `category` | Short security category. |
| `target` | Repository-relative surface, boundary, or configuration being checked. |
| `method` | Source trace or explicitly permitted local method. |
| `executed` | `yes` or `no`; source inspection counts as `yes`. Do not call a blocked runtime check executed. |
| `result` | Exactly `OK`, `NG`, `要確認`, `未実施`, or `対象外`. |
| `reason` | The evidence-based explanation for the result. |
| `evidence` | Repository-relative file/line, safe command/result, or non-sensitive artifact reference. |
| `gap` | Missing fact, blocker, residual limit, or `—`. |

Order items as IPA 1.1–1.11, supplemental checks, then Cloudflare-only coverage. Count each canonical item once even when `frameworks` contains several references.

Maintain a separate deduplicated finding list keyed by root-cause fingerprint. One finding may reference many items/frameworks. Do not multiply severity or finding counts by framework mappings.

## Mandatory Sections

Both reports contain the same section order and facts:

1. title, generation time, source ref, dirty state, profile, execution mode, authorization boundary, and overall `complete`/`incomplete` state;
2. result counts for `OK`, `NG`, `要確認`, `未実施`, and `対象外`;
3. component table for `ipa-checklist` and `cloudflare-source`, including requested/executed/state/scope/evidence/gap;
4. framework coverage summary;
5. the complete canonical audit-item matrix;
6. IPA 1.1–1.11 mapping table with result, mapped finding ID or `—`, evidence, and reason;
7. deduplicated confirmed `NG` findings;
8. `要確認` candidates and exact safe next validation step;
9. constraints, exclusions, `未実施`, and `対象外` rationale;
10. artifacts, reproducibility/provenance, methodology source, and tool/template versions.

The first page/screen must state that completion is process status and does not mean vulnerability-free. For `preflight`, state explicitly that no audit inspection was requested or performed.

## Finding Contract

Follow `security-audit` certainty and evidence rules:

- A confirmed finding identifies the lower-trust principal/input, intended control, crossed boundary, affected principal/resource, concrete outcome, source evidence, priority, and smallest effective source fix.
- A source-profile candidate missing a decisive fact appears under `要確認`, never as a confirmed finding.
- A full audit with unvalidated candidates remains `incomplete` under the vendored skill's terminal-state rules; do not downgrade an unvalidated candidate merely to make the report complete.
- Checklist/hardening gaps without a concrete outcome remain item reasons or `要確認`, not invented vulnerabilities.

## Markdown and HTML Parity

Before delivery, compare the generated projections from the canonical data. They must match on:

- source ref, profile, execution mode, component and overall status;
- item IDs/order, framework references, results, and reasons;
- all five result counts;
- finding fingerprints/IDs, priorities, and mappings;
- incomplete reason, exclusions, and provenance.

If parity cannot be established, set the report run `incomplete` and disclose `report_projection_mismatch`; do not choose one format as authoritative without saying so.

## Safe HTML Rules

- Embed all CSS; use no scripts, remote fonts, images, analytics, tracking, iframes, or network resources.
- HTML-escape every inserted string, including file paths, reasons, and evidence. Never interpolate untrusted text as markup.
- Use semantic headings, tables with captions/header cells, visible focus, responsive overflow, and print styles.
- Replace every `@@TOKEN@@` and remove template comments before delivery. An unresolved token makes the HTML incomplete.
- Do not embed source files, secrets, environment values, real user data, raw logs, screenshots of personal data, or absolute workstation paths.

## Provenance

Name the two methodologies precisely:

- IPA: 「安全なウェブサイトの作り方」 11 vulnerability categories and official URL.
- Cloudflare-authored methodology: vendored `security-audit` source-first workflow and its recorded project SHA/inventory, not a Cloudflare service/account inspection.

Record source ref and dirty state so a reader can reproduce which source was examined. Do not claim the commit SHA includes uncommitted files.

