# 追加デモスポット Implementation Plan

**Goal:** 追加と識別できるCSVを先に作成し、網羅性を補う架空スポット10件を登録する。

**Architecture:** 固定CSVを専用CLIで検査し、fixture名前空間へ新規追加する。既存データは競合時スキップする。

**Tech Stack:** TypeScript、csv-parse、Zod、Node.js 26、pnpm 11.25.0、PostgreSQL。

**Spec:** `docs/superpowers/specs/2026-11-09-additional-demo-spots-design.md`

## 制約

- 元CSV・秘密・利用者の実値を読出しログやコミットへ含めない。
- この依頼のテスト・独立レビューは未承認のため実行しない。TDD等の既定よりAGENTS.mdを優先する。
- 並行中のUI変更は編集・ステージしない。作業はメイン担当がこの場で実行する。

## 手順

- [x] 既存7件のタグ・同行者と提供データの構成を確認する。
- [x] 追加10件だけのCSVを `data/additions/2026-11-09-additional-demo-spots.csv` へ先に作る。
- [x] `src/server/additional-spots-cli.ts` と `data:import-additions` を追加する。列とタグを検査し、同一外部IDを上書きせずtransactionでINSERTする。
- [x] データ資料・仕様へ出所、画像の扱い、再投入方法、既存冊子への反映タイミングを記載する。
- [x] Node 26・固定pnpmでbuildし、追加CLIを一度実行して登録結果を記録する。
- [x] 3001番のこのプロジェクトだけをHidden再起動し、トップとhealthの配信を参照する。
- [x] 実行した作業と未実施の検証を記録し、自分の変更だけをステージ内容確認のうえコミットする。
