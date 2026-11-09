# IPA + Cloudflare Web Security Audit Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ZAP依存を持たず、IPA 11項目とCloudflare source/full auditを統合してHTML／Markdownレポートを生成するproject-local skillを追加する。

**Architecture:** `web-security-audit`をrouting layerとして再作成し、固定IPA checklist、profile/scope、report contractを参照ファイルへ分離する。Cloudflare vendorは既存`security-audit`をsub-skillとして呼び出し、findingをframework横断でdeduplicateする。

**Tech Stack:** Markdown skill instructions、self-contained HTML template、project skill inventory JSON

**Spec:** `docs/superpowers/specs/2026-11-09-ipa-cloudflare-audit-skill-design.md`

## Global Constraints

- ZAP、Java、Docker、active scanを要件へ含めない。
- `.agents/skills/security-audit` vendorファイルを変更しない。
- `Password*`、`.env`、元CSV、実利用者データ、uploads、写真を読まない。
- 現在のpnpm/server関連の未コミット変更を変更・stage・commitしない。
- 自動テスト・独立レビューはユーザーの明示依頼がないため実行しない。

## Review Focus

- IPA項目が「framework checklist」だけでNGを生成せず、実証済みcontrol failureだけをNGにすること。
- managed languageを理由に1.10を自動対象外にせず、native parser/decoder/FFIを追跡すること。
- sandbox不足がIPA source checklist全体を不必要に未実施へしないこと。
- IPAとCloudflareの同じ根本原因が重複findingにならないこと。
- MarkdownとHTMLのitem order、counts、status、source refが一致すること。

---

### Task 1: Core skill and IPA checklist

**Files:**
- Create: `.agents/skills/web-security-audit/SKILL.md`
- Create: `.agents/skills/web-security-audit/references/ipa-checklist.md`

**Interfaces:**
- Consumes: existing `.agents/skills/security-audit/SKILL.md`
- Produces: profile routing, IPA checklist IDs `IPA-1.1` through `IPA-1.11`, supplemental IDs

- [ ] Create the skill frontmatter and routing instructions with `preflight`, `source`, and `full` profiles.
- [ ] Define authorization, secret/data exclusions, sandbox boundary, evidence bar, and framework deduplication.
- [ ] Define source-review questions and result rules for IPA 1.1〜1.11 plus supplemental side-channel/operations checks.

### Task 2: Scope, completion, and reporting contract

**Files:**
- Create: `.agents/skills/web-security-audit/references/scope-and-profiles.md`
- Create: `.agents/skills/web-security-audit/references/reporting-contract.md`
- Create: `.agents/skills/web-security-audit/assets/report-template.md`
- Create: `.agents/skills/web-security-audit/assets/report-template.html`

**Interfaces:**
- Consumes: Task 1 profile names and IPA IDs
- Produces: canonical audit item fields, component completion rules, Markdown/HTML output shape

- [ ] Define generic scope plus MC-010 safe defaults and exclusions without dynamic scanner routes.
- [ ] Define component states for `ipa-checklist` and `cloudflare-source` and overall terminal states.
- [ ] Define one canonical ordered item list with `frameworks` and a separate IPA mapping table.
- [ ] Adapt Markdown and offline HTML templates, replacing Active scan/ZAP fields with execution mode and framework coverage.

### Task 3: Project integration metadata

**Files:**
- Modify: `docs/skills.md`
- Modify: `docs/skill-installation.json` through the existing inventory writer

**Interfaces:**
- Consumes: completed `.agents/skills/web-security-audit` tree
- Produces: discoverable project documentation and current file hashes/counts

- [ ] Document the project-local IPA + Cloudflare integration separately from the fixed Cloudflare vendor source.
- [ ] Run only the inventory write operation needed to record the new files; do not run product tests, audit tests, or independent review.
- [ ] Inspect the final diff limited to the planned paths and report all unexecuted verification.
