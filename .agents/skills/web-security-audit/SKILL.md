---
name: web-security-audit
description: Use when planning or running an authorized IPA and Cloudflare source security audit for a local web application, especially when fixed checklist coverage, trust-boundary validation, sandbox-aware execution, and matching HTML and Markdown reports are required
---

# IPA + Cloudflare Web Security Audit

## Overview

Combine the fixed 11 categories from IPA's 「安全なウェブサイトの作り方」 with the source-first, trust-boundary evidence standard in the vendored Cloudflare `security-audit` skill. Produce one deduplicated set of audit items and findings, then render the same facts to Markdown and offline HTML.

This skill audits application source and authorized local evidence. It does not audit a Cloudflare account, WAF, DNS, CDN, or edge configuration, and it does not require or run a dynamic scanner.

**REQUIRED SUB-SKILL:** Read `.agents/skills/security-audit/SKILL.md` before Cloudflare source review or a full audit. Follow its source visibility, evidence, lifecycle, sandbox, and terminal-state rules. Do not modify the vendored skill.

## Use This Skill When

- The user asks for an IPA web security checklist, Cloudflare security audit, or both.
- The deliverable must explain what was checked, the result, the reason, and the evidence.
- Markdown and self-contained HTML reports must agree.
- An OS-enforced sandbox may be unavailable and source-only progress must remain possible.

Do not use it for unauthorized targets, live penetration testing, availability testing, or control-plane review. Do not label Cloudflare-authored methodology as a Cloudflare product or account audit.

## Hard Gates

1. Record the authorized repository/source ref, profile, scope, exclusions, requested components, and output directory before inspection.
2. Never read or retain `Password*`, `.env*`, credentials, source CSV, real names, email addresses, free-form responses, uploads, user photos, or production data. Use schemas, code, and dummy values only.
3. Source inspection is read-only and may proceed without an OS sandbox.
4. Run target-controlled builds, tests, processes, browsers, parsers, fixtures, or generated code only when every sandbox control required by `security-audit` is present. Otherwise keep the source review and record the exact runtime fact as `要確認` or `未実施`.
5. Do not probe deployed endpoints, external services, shared infrastructure, real identities, or live control planes.
6. A missing best practice or checklist control is not automatically a vulnerability. Use `NG` only for a concrete control failure or independently validated trust-boundary violation with an affected principal, resource, or security outcome.

## Profiles

| Profile | Required work | Target-controlled execution |
|---|---|---|
| `preflight` | Fix authorization, source ref, scope, exclusions, requested components, output path, and blockers. | Prohibited |
| `source` | Complete the IPA source checklist and Cloudflare source review in guidance mode. | Prohibited unless the user separately requests a permitted local check and all sandbox gates are met |
| `full` | Run the complete vendored `security-audit` workflow and map its coverage/findings to the IPA checklist. | Allowed only inside the required OS-enforced sandbox |

Read [references/scope-and-profiles.md](references/scope-and-profiles.md) for scope defaults and completion rules.

## Workflow

1. **Preflight.** Create run metadata with repository, source ref, dirty state, profile, scope, exclusions, authorization boundary, requested components, output directory, and any known execution blocker.
2. **Map surfaces.** Identify request entry points, authentication/session state, authorization decisions, database and command sinks, file and URL handling, browser rendering, mail/header construction, native parsers/decoders/FFI, dependency manifests, and deployment assumptions. Do not open excluded data.
3. **Apply IPA coverage.** Read [references/ipa-checklist.md](references/ipa-checklist.md). Create one item for every `IPA-1.1` through `IPA-1.11` and every applicable `SUP-*` item. Give each item a result and source-backed reason; never silently omit an item.
4. **Apply Cloudflare methodology.** For `source`, use `security-audit` guidance mode to trace trust boundaries and distinguish confirmed failures from missing facts. For `full`, follow all phases, ledgers, candidate validation, schemas, and terminal states from that skill.
5. **Unify evidence.** Maintain one canonical ordered item list with `id`, `frameworks`, `category`, `target`, `method`, `executed`, `result`, `reason`, `evidence`, and `gap`. Framework references use `IPA-1.x`, `SUP-xx`, and the applicable Cloudflare coverage or finding identifier.
6. **Deduplicate findings.** Fingerprint by root cause, affected boundary/resource, and source location. If one root cause satisfies IPA and Cloudflare criteria, emit one finding with multiple `frameworks`; do not duplicate it by framework or endpoint.
7. **Report.** Follow [references/reporting-contract.md](references/reporting-contract.md). Generate `REPORT.md` and `REPORT.html` from the same canonical items, counts, component states, findings, and provenance.

## Result Vocabulary

| Result | Meaning |
|---|---|
| `OK` | The expected control was traced and the available evidence supports it for the stated scope. |
| `NG` | A concrete control failure or validated boundary violation is established by the evidence. |
| `要確認` | A candidate or control depends on a specific missing source, configuration, deployment, or runtime fact. |
| `未実施` | An in-scope check could not be performed; record the blocker and safe next step. |
| `対象外` | The relevant surface does not exist in scope; cite source evidence for absence. |

`complete` / `incomplete` describe process completion, not security quality. A complete report may contain `NG`; an incomplete report must name the unresolved component and reason.

## Common Mistakes

- Marking a best-practice gap `NG` without a concrete boundary and outcome.
- Marking `IPA-1.10`対象外 only because the main language is memory-safe; trace image/document decoders, native modules, database drivers, FFI, and external parsers first.
- Treating missing sandbox capability as a blocker for source inspection.
- Producing separate IPA and Cloudflare findings for one root cause.
- Hand-editing HTML and Markdown independently so order, counts, or status diverge.
- Calling this a Cloudflare account audit or implying that CDN/WAF settings were reviewed.

