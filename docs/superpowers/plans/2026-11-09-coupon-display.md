# Coupon Display Implementation Plan

> **For agentic workers:** executing-plansで現在セッションにて実装する。ユーザーの具体的な画面注釈を採用し、AGENTS.mdに従い追加テスト・レビューは実行しない。build・migration・対象アプリのHidden再起動・最小HTTP参照を行う。

**Goal:** プレゼント表記をクーポンへ統一し、英数字6桁のコード表示と「使う」での一度限りの利用記録を提供する。

**Architecture:** 既存の設定・利用履歴を維持するためhasGift/gift-claimの内部契約は保持する。新しいspot_coupon_codesへ利用者×スポットの固定コードを保存する。表示用POSTはコード発行のみ、利用用POSTだけが既存の履歴を1件記録する。

**Tech Stack:** TypeScript / React SPA / Node 26 / PostgreSQL、追加依存なし。

**Spec:** ユーザーの2026-11-09ブラウザ注釈1〜8。現在のdocs/spec.md・docs/design.mdと採用画像を引き継ぐ。

## Decisions

- ラベル「クーポンあり」、詳細ボタン「クーポンを表示する」、確認見出し「クーポンをつかう」、確定ボタン「使う」。説明・使用済み・町側設定/履歴もクーポン表記へ合わせる。
- コードは利用者×スポットに対しサーバーの乱数で英大文字・数字6文字を発行。同じ組合せには同じコードを返し、コード重複はDBのUNIQUEと再生成で防ぐ。コードはログ・PNG・プレビューへ出さない。
- 表示やキャンセルでは利用件数を増やさない。既存の使用済み履歴を消さず、提供再開でも再利用不可。コードだけを認証や他人の利用に使うAPIは追加しない。
- POST /api/spots/:id/coupon は空JSON、本人の冊子・公開/提供状態を確認しcouponCodeとgiftClaimを返す。使用済みはコードを発行しない。
- 既存POST /api/spots/:id/gift-claim は発行済みコードの存在も確認してから利用を記録し、再送は既存履歴を返す。管理履歴の返却フィールドは変更しない。

## Tasks

- [x] 005 migration、表示API・共有型、既存利用APIの発行確認を実装。
- [x] 詳細/確認UIへコード・文言・読み込み状態を追加し、町側と一覧の表記を統一。
- [x] spec/design/database/READMEと今回の未検証範囲を更新。
- [x] Node 26 build、migration、3001番を同定してHidden再起動、最小HTTP参照、ステージ内容を確認してコミット。

反映根拠: Node 26.13.0 / pnpm 11.25.0のbuild・db:migrateは終了コード0。3001番の対象PID 14400のみ停止しHidden PID 29968で起動。GET / と /api/health が200、新JSはindex-Dxgwv2Rm.js。追加テスト・レビューは未実施。詳細はdocs/verification.md。

## Later verification focus (not executed)

- 表示/キャンセルで利用件数が増えず、再表示・再ログイン時のコードが不変。
- 他人のスポット・管理者からの発行/利用拒否、未発行利用拒否、コード衝突と同時発行の収束。
- 利用・並列再送・提供終了との競合、使用済み履歴の維持、モーダルフォーカスと狭幅表示。
