# Spot Details and Gift Claims Implementation Plan

> **For agentic workers:** executing-plansにより現在セッションで実装する。ユーザーの最新指示に従いQR案は取り消し、本人の確認後に一度だけ受け取る方式とする。AGENTS.mdに従い、この変更依頼では追加テスト・レビューを実行せずbuild・migration・限定再起動・最小HTTP参照を行う。

**Goal:** スポット詳細、プレゼント設定/ラベル、本人の一度限りの受取、町側の件数・来訪履歴を追加。

**Architecture:** spots.has_giftとspot_gift_claimsを追加。本人の冊子に存在するスポットだけを詳細/受取対象とし、ユーザーはセッションから特定。受取はUNIQUE(user_id,spot_id)で一度限り。同じ操作を再送しても履歴を増やさない。

**Tech Stack:** TypeScript / React / Node 26 / PostgreSQL。追加依存なし。

**Spec:** 2026-11-09のユーザー指示と「QRではなくプレゼントを受け取るボタン、再度受け取れない確認ダイアログのOK後に計測」という最新訂正。

## Constraints and choices

- 着手前の現状コミットfdef044を作成済み。QR案の未適用migrationと未実装計画を破棄し、追加したQR依存も除去する。
- 写真・名称・モデルプランから詳細モーダルを開く。通常テキストで名称/説明/写真/体験タグ/同行者を表示。
- 管理画面はプレゼントありcheckboxを明示保存。preview、パンフレット、変更候補一覧、管理スポット一覧にラベルを表示する。
- 詳細では「プレゼントを受け取る」→「受け取ると再度受け取れません」の確認→OKで本人の受取をPOST。キャンセルや表示/previewでは計測しない。受取後は時刻と受取済み表示。
- 受取は利用者本人だけ。町権限で履歴を参照。停止中/プレゼントなしは新規受取不可。既存受取は設定変更後も保持し、同じ利用者の再受取は不可。
- 受取は来訪の申告記録であり実在地の位置検証ではない。CSV由来のスタンプ履歴へ混ぜず「来訪履歴（プレゼント受取）」として日時・匿名利用者・スポットと件数/人数を表示する。
- previewは受取操作を出さない。PNGにはラベルを残し、詳細操作/受取ボタンは含めない。外部送信・公開範囲・認証の変更なし。
- DBの一度限り制約とtransactionで並列要求・応答喪失後の再送も1件にする。入力へユーザーIDや時刻を受け付けない。

## Tasks

- [x] migration/共有型/プレゼント設定API/本人の詳細と受取API/町側履歴と件数API。
- [x] パンフレット詳細モーダル、確認ダイアログ、本人の受取済み状態とpreviewの受取操作非表示。
- [x] 管理checkboxとラベル、来訪履歴の絞り込みとページング、スポット別件数。
- [x] spec/design/database/READMEと未検証範囲を更新。
- [x] Node 26でbuild、追加migration適用、3001番の対象アプリだけHidden再起動、最小HTTP確認。

反映根拠: Node 26.13.0 / pnpm 11.25.0のbuild・db:migrateが終了コード0。対象PID 21912のみ停止し、Hidden PID 14400で起動。GET / と /api/health が200、新JSはindex-C6A3z194.js。詳細はdocs/verification.md。追加テスト・レビューは未実施。

## Later verification focus (not run in this change)

- 所有者分離、未認証/町側の受取拒否、GETやキャンセルで記録しないこと。
- 並列受取・再送・再ログイン後も1件、提供/公開停止との競合。
- モーダルのキーボードとフォーカス復帰、preview/PNGの操作除外、受取失敗の再試行と件数保持。
