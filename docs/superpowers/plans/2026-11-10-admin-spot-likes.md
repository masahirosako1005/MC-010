# 管理画面のいいね集計 Implementation Plan

**Goal:** 公開しおりに保存されたスポットのいいねを管理画面で確認できるようにする。

**Architecture:** 既存のshare_spot_likesを読み取り集計し、管理APIと共有型、既存の数値カード・表へ追加する。新しい保存先・migration・外部依存は追加しない。

**Tech Stack:** TypeScript、React SPA、Node.js 26、PostgreSQL。

**Spec:** docs/spec.md、docs/design.md。

## 設計

既存の共有状況・作成詳細・スポット一覧と詳細分析へ件数を追加する。新設の分析画面やイベント履歴化は今回の目的に不要なため採用しない。いいねは取消後の行が残らないため累計操作数・日別イベントとは扱わない。

しおりの所有者がvisitorである記録を集計し、範囲切替は所有者のsourceに従う。公開停止・現在は掲載されていないスポットの保存済みいいねを含める。同じ閲覧者が別のしおり・スポットにつけたいいねは別件であり、人数とはしない。visitor_hashや共有トークンを管理応答へ追加しない。

## 実装手順

- [x] src/shared/sharing-types.ts、admin-types.ts、admin-detail-types.tsへ件数の型を追加する。
- [x] src/server/sharing.ts、admin.ts、admin-details.tsへ既存の権限境界内で集計を追加する。結合によるアクセス・コピー数の重複を避ける。
- [x] src/client/AdminDashboard.tsx、AdminRegistrationDetail.tsx、AdminSpotAnalytics.tsxに件数と集計条件を表示する。既存のスクロール可能な表と数値カードを再利用する。
- [x] docs/spec.md、docs/design.mdへ仕様を記録する。
- [x] Node 26・固定pnpmでビルドし、このプロジェクトの3001番アプリを同定してHiddenで再起動、最小HTTP参照で配信確認する。

ユーザー指示に従い、テスト・check・audit・独立レビューは実施しない。既存の未コミット変更は保持し、今回のファイルだけコミットする。

## 実施結果

Node.js 26.13.0／pnpm 11.25.0で `pnpm run build` 成功。3001番で稼働するプロジェクトのNodeサーバーを同定し、Hiddenで再起動した。HTTP GET `/` が200を返し、生成済みHTMLと同じJSアセットを参照することを確認した。テスト・check・audit・独立レビュー・ブラウザ操作確認は未実施。
