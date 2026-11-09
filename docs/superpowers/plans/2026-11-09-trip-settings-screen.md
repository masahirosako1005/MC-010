# Trip Settings Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 承認画像に対応する独立条件画面と、条件確定後に初めて生成する流れを実装する。

**Architecture:** Reactの独立コンポーネントを初回ログインと既存編集から共有。初回ensureにsettingsを渡し、編集時は既存のdraft付き再生成を使う。編集親を維持し、失敗写真の一時状態を失わない。

**Tech Stack:** React SPA / TypeScript / Node26 / PostgreSQL / Vitest / Playwright。依存追加なし。

**Spec:** `docs/superpowers/specs/2026-11-09-trip-settings-screen-design.md`

## Global Constraints

- 復旧点 `1e4989f`。ユーザー指定の現在workspaceで作業。秘密・Password・元CSV・アップロード・DB・runtimeは読取/commit対象にしない。
- 主ボタンは正確に「この内容でパンフレットを作る」。同行者は家族/子ども/パートナー/友人/親/一人。
- 初回ログイン→条件選択→生成→パンフレット。保存済み冊子は復元し上書きしない。
- スマホ同行者3列×2段、日帰り/宿泊（一泊二日）、テーマ（テンプレート指定）のゆっくり/アクティブ。
- 本人実績だけを表示し、デモ画像規則を維持。主要色はアイボリー/コーラル/オレンジ/黄色/明るい青。

## Review Focus

- 別タブの同時初回生成: 先に確定した冊子1件を維持する（Task1の既存並列ensure＋既存冊子不変テスト）。
- 本人以外/未訪問/空の再訪ID: 初回生成しない（Task1の不正条件テスト）。
- API503: 条件を保持し再試行できる（Task2のブラウザテスト）。
- 未保存コメントと失敗写真: 条件画面へ往復・再生成しても保持する（Task2の既存回帰拡張）。
- 小画面の長い選択肢: 320pxと390pxで3列を維持し横はみ出ししない（Task3の寸法・目視確認）。

### Task 1: 初回生成の条件契約

**Files:** `src/server/validation.ts`, `src/server/app.ts`, `src/server/brochures.ts`, `tests/api.test.ts`

**Interfaces:** `ensureBrochure(db, userId, settings?: TripSettings): Promise<Brochure>`。body `{settings?: TripSettings}`、既存の `{}` も有効。

- [ ] 指定した家族/一泊二日/active/本人再訪先で生成し、既存冊子を別条件で上書きしないAPIテストを書く。
- [ ] 空/重複/未訪問IDの拒否と冊子0件をテストし、未実装の失敗を確認する。
- [ ] strict body、本人ID検証、行ロック下での条件適用を実装する。
- [ ] Node26＋専用PostgreSQLでAPI/既存テストを実行して合格を確認しcommit。

### Task 2: 独立画面と状態遷移

**Files:** 新規 `src/client/TripSettingsScreen.tsx`, `src/client/trip-settings.css`。変更 `src/client/App.tsx`, `tests/e2e/brochure.spec.ts`。

**Interfaces:** Screen propsはsession、任意brochure、onGenerate(settings, mode)、任意onCancel、generatingView。初回Appはensure、既存BrochureEditorはregenerateを呼ぶ。

- [ ] 初回は条件画面のみでensure0回、主ボタンで生成し選択が反映されるブラウザテストを書く。現行版の失敗を確認する。
- [ ] 既存ログインhelperを新フローへ合わせ、モーダル前提の回帰を独立画面の戻る/フォーカスへ更新する。
- [ ] 承認画像のセクション順・写真・チェック・6同行者・2択・主ボタンをコンポーネント/CSSで実装する。
- [ ] 初回API失敗時の選択保持と、既存draft/失敗Fileを持つ親を維持する画面切替を実装する。
- [ ] 全ブラウザ回帰、型、buildを確認しcommit。

### Task 3: 目視・資料・最終統合

**Files:** `README.md`, `docs/spec.md`, `docs/design.md`, `docs/database.md`, `docs/verification.md`, `docs/verification/trip-settings-*`。

**Interfaces:** 既存専用検証DB/fixtureを利用し、通常デモの編集をリセットしない。PC/スマホの実ブラウザPNGを保存する。

- [ ] 320px/390px/PCで横はみ出し・3列・キーボード・戻る・エラーを確認する。
- [ ] PC/スマホのフルページ実画面を保存しview_imageで承認画像と比較、必要箇所を修正する。
- [ ] 既存コピー/PNG/写真/保存/再生成を含む全テスト、typecheck/build/audit/inventoryを実行する。
- [ ] 一名の新しい読み取り専用レビューで全差分を確認し、重要問題を修正・再検証する。
- [ ] docsを最新フロー・証拠・限界で更新、秘密除外確認後にcommit。通常デモへ反映、healthとgit statusを確認。
