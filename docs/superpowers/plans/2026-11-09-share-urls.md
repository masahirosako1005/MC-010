# Share URLs Implementation Plan

> **For agentic workers:** writing-plans / executing-plansで現在セッションにて実装する。共有保留は今回のユーザー依頼で解除。AGENTS.mdに従い追加テスト・レビューを実行せず、build・migration・Hidden再起動・最小HTTP参照だけを行う。

**Goal:** 保存済み冊子をログイン不要の共有URLで閲覧でき、表示回数とプレビューのURLコピーを提供する。クーポンは作成者本人のログイン時だけ表示・利用できる。

**Architecture:** brochure_sharesへ冊子ごとのランダムURLと公開状態・表示回数を保持し、share_page_viewsへページ表示UUIDを記録する。公開APIは選択中と訪問済み思い出itemだけを返し、写真も共有URLで認可する。SPAは編集画面と共通の紙面を読み取り表示する。

**Tech Stack:** TypeScript / React SPA / Node 26 / PostgreSQL、追加依存なし。

**Spec:** 最新ユーザー指示、docs/spec.md・docs/design.mdと採用済み紙面を継承する。

## Decisions

- URLは冊子単位の256bit乱数。コピー操作で発行・公開し、同じURLから最新の保存内容を参照する。未保存編集・写真保存中/失敗時はコピー不可とし保存を案内する。公開停止・再開も作者のプレビューから可能。同じURLと累積件数を維持する。
- 共有は掲載スポットと選択した思い出の写真・コメントを含む。全item、アンケート、実値メール/氏名、全訪問履歴、クーポンコードは共有APIへ含めない。写真を公開静的フォルダーへ移動しない。
- GET公開本文と画像は計測しない。表示後にページごとのUUIDでPOSTし、同じUUIDの再送・React StrictModeでは1件、リロードは新しい1件。個人の特定・ユニーク人数の集計ではない。URL先読みや画像要求は対象外。
- 未ログイン・別利用者・町アカウントにはhasGift=false、クーポン状態/コードなし。公開GETのセッション照合で作成者本人だけviewerIsOwner=true。本人の詳細/表示/利用APIは既存のセッション所有者検証を維持する。
- 作者プレビューへURLコピー・手動コピー用URL・公開停止・表示回数/更新を追加する。町側へ匿名の共有状況（出所・公開状態・回数・日時）の25件ページングを追加し、生URLや個人写真を返さない。
- 既存のローカル限定・Origin制限を維持する。共有先も現在のローカルアプリへ接続できる環境を前提とし、LAN/クラウド公開は追加しない。

## Tasks

- [x] db/migrations/006_brochure_shares.sql、src/shared/sharing-types.ts、src/server/sharing.ts: 本人用発行/参照/停止、公開紙面/写真/表示記録、町側匿名集計。app.tsへ認証前後を区別して接続。
- [x] App.tsxの紙面を共通化、共有URL用読み取り画面、SpotDetailDialogの非所有者表示、プレビューのSharePanelを追加。
- [x] AdminDashboard.tsxとCSSへ共有状況の集計・一覧を追加。
- [x] spec/design/database/README/verificationへ共有範囲・表示計測・所有者制約・未実施範囲を記載。
- [x] Node 26でbuild、migration、3001番の対象のみHidden再起動、トップ/healthの最小HTTP参照、ステージ内容確認とコミット。

反映根拠: Node 26.13.0 / pnpm 11.25.0のbuild・db:migrateが終了コード0。初回反映後、思い出の最新日時/スタンプを対象スポットごとに1件だけ返すよう補完して再build。3001番の対象PID 25164のみ停止し最終Hidden PID 25816で起動。GET / と /api/health は200、新JSはindex-CrWQU1dY.js。追加テスト・レビューは未実施。利用中データのURLを確認目的で発行/公開していない。詳細はdocs/verification.md。

## Future verification focus (not executed)

- 未認証/別利用者/町アカウントにクーポンや未掲載item・surveyを返さず、本人のみ表示/利用可能。
- 写真ID差替・無効/停止URL・生の個人写真URLのアクセス境界。
- 並列発行、表示UUID再送/重複/リロード、失敗後の再試行、公開停止と再開で件数保持。
- 未保存編集/写真、狭幅のURLコピーと読取紙面、モーダル・PNG・既存編集保持。
