# IPA + Cloudflare Web Security Audit Skill Design

## Intent

OWASP ZAPを実行できない環境でも、Webアプリケーションのセキュリティ監査を再現可能な形で実施する。IPA「安全なウェブサイトの作り方」の11分類と補足チェック、および同梱済みCloudflare `security-audit` の信頼境界ベース監査を統合し、HTMLとMarkdownの監査レポートを出力する。

## Goals

- 既存の発見名 `web-security-audit` を維持する。
- ZAP、Java、Docker、active scanを要件・判定・レポートから削除する。
- IPA 1.1〜1.11と、記事に対応するサイドチャネル／運用補足を固定チェックリストとして提供する。
- Cloudflare vendorスキルを変更せず、必要時に`security-audit`をsub-skillとして使用する。
- 同じ根本原因をIPAとCloudflareで重複所見にせず、1件の所見へ複数framework参照を付ける。
- `REPORT.md`とself-contained `REPORT.html`を同一の監査項目から生成する。

## Non-goals

- Cloudflare account、WAF、DNS、CDN、edge ruleの監査。
- ZAPその他DASTツールの実行。
- 公開・共有・本番環境への能動的なprobe。
- vendor配下の`.agents/skills/security-audit`の直接変更。

## Constraints

- `Password*`、`.env`、元CSV、実値の氏名・メール・自由回答、uploads、ユーザー写真を読まない・保持しない。
- Cloudflareのtarget-controlled build/test/process/browser/fixtureは、既存`security-audit`のOS強制sandbox要件を満たす場合だけ実行する。
- sandboxがなくてもIPAとCloudflareのsource traceは実施できる。未観測deployment/runtime factは`要確認`または`未実施`とする。
- 現在のdirty worktreeにあるpnpm・server変更へ触れない。

## Approaches

1. **既存名を維持して統合スキルを再作成（採用）** — 呼び出し互換を保ち、IPA・Cloudflare・報告を1つのworkflowへまとめる。
2. IPA専用スキルを追加 — 責務は分離できるが、scope・finding・reportが二重化する。
3. Cloudflare vendorスキルを改変 — upstream更新で失われるため不採用。

## Structure

```text
.agents/skills/web-security-audit/
├── SKILL.md
├── references/
│   ├── ipa-checklist.md
│   ├── scope-and-profiles.md
│   └── reporting-contract.md
└── assets/
    ├── report-template.md
    └── report-template.html
```

`SKILL.md`はrouting・hard gate・profile・共通workflowだけを持つ。IPAの項目別判断は`ipa-checklist.md`、profile完了条件は`scope-and-profiles.md`、成果物契約は`reporting-contract.md`へ分離する。

## Profiles

- `preflight`: source ref、scope、除外、出力先、requested componentsを確定する。target codeは実行しない。
- `source`: IPA checklistとCloudflare source reviewを実施する。sandboxがなくても選択可能。
- `full`: `security-audit` full workflowを実施し、必要なlocal validationは要件を満たすOS sandbox内だけで行う。ZAPは使用しない。

## Evidence and Deduplication

監査項目は`id`, `frameworks`, `category`, `target`, `method`, `executed`, `result`, `reason`, `evidence`, `gap`を持つ。同じsource path/root causeが複数frameworkに該当する場合、1つのfinding fingerprintへIPA IDとCloudflare coverage IDを関連付ける。IPAチェックリストの欠落だけでNGにせず、実際のcontrol failureまたは独立検証済みboundary violationをNGとする。

## Reporting

レポートはoverall status、framework/component status、判定数、完全なaudit-item matrix、IPA 11項目対応表、NG、要確認、制約、provenanceの順に記載する。判定は`OK`, `NG`, `要確認`, `未実施`, `対象外`。HTMLはoffline/self-containedで、script・remote resource・trackingを含めない。

## Documentation and Inventory

`docs/skills.md`へproject-local統合スキルを追記し、`docs/skill-installation.json`のinventoryを更新する。Cloudflare vendorの出所・SHAは変更しない。
