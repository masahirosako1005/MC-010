# 町側詳細画面の実装計画

> 担当はメインがinlineで実装する。AGENTS.mdを優先し、依頼のないテスト・レビュー・委任は実行しない。

**Goal:** 匿名の作成詳細とスポット別の分析を既存管理画面から開く。
**Architecture:** 町権限内の読み取りAPIを追加し、共通管理UI部品と専用詳細画面で表示する。DB schemaは変更しない。
**Tech Stack:** TypeScript、React SPA、Node 26、PostgreSQL、既存Lucide・CSS token。
**Spec:** `docs/superpowers/specs/2026-11-09-admin-details-design.md`

## 制約・判断

- 氏名・メール・回答・コメント本文・ユーザー写真・共有URL／コードは返さない。
- 累計・現在の掲載・期間内イベントを区別し、分母と集計基準を明示する。
- 未作成、0件、公開停止、取得失敗・再試行、条件変更中の応答競合を扱う。
- Ruling: 直接の追加指示と既存管理仕様をもとに実装方式を決定。別のデザイン承認では作業を中断しない。既存の管理画面と匿名化方針を維持する。
- Ruling: 作業中の監査レポート2件は触らず、現チェックアウトで対象ファイルだけを変更する。
- Ruling: テスト・レビューのスキル既定より、AGENTS.mdの明示依頼限定ルールを優先する。

## Task 1: 型と読み取りAPI

- [x] `src/shared/admin-detail-types.ts` に作成詳細／分析DTOを追加。
- [x] `src/server/admin-details.ts` にscope・UUID・日付検証、read-only transaction、2 APIを追加。
- [x] `src/server/admin.ts` の既存町権限middlewareの後からmount。

## Task 2: 詳細画面と一覧の導線

- [x] `src/client/admin-ui.tsx` へ既存のrequest・取得hook・状態・Metricを共通化。
- [x] `src/client/AdminRegistrationDetail.tsx` に条件・登録状態・公開状態の表示。
- [x] `src/client/AdminSpotAnalytics.tsx` に累計・内訳・期間推移・日別表・最新掲載を表示。
- [x] `src/client/AdminDashboard.tsx` の一覧から開閉。検索・ページ・編集中フォームを保持し、戻り先へフォーカス／スクロールを戻す。
- [x] `src/client/admin-details.css` で既存配色・44px操作領域・PC/スマホの配置。

## Task 3: 文書と反映

- [x] spec/design/database/READMEに入口・指標・境界・制限を記載。
- [x] Node 26・固定pnpmでbuild。
- [x] 3001番のNode実体・entrypoint・待受を同定してそのプロセスだけHidden再起動。
- [x] GET / と /api/healthで配信確認し、verificationへ結果と追加テスト・レビュー未実施を記載。
- [x] 機能反映時は作業ツリーに保持。後続のコミット依頼に従い、対象差分を公開URL計測とともにコミットする。
