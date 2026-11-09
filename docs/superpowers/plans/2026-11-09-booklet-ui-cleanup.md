# Booklet UI Cleanup Implementation Plan

> **For agentic workers:** writing-plans / executing-plansで現在セッションにて実装。最新10件のブラウザ注釈を採用する。AGENTS.mdに従い追加テスト・レビューを実行せず、build・対象アプリのHidden再起動・最小HTTP参照だけを行う。

**Goal:** 紙面の概要/推薦理由と訪問順をわかりやすくし、招待文・PNG・不要なURL表示を取り除く。

**Architecture:** 既存React画面とCSSだけを変更。DB/API契約・共有URL・表示計測・クーポン認可は維持し、既存データを削除しない。概要/推薦理由は既存description/reasonと保存済み旅条件からローカル定型で表示する。

**Tech Stack:** TypeScript / React / Node 26 / PostgreSQL。追加依存なし。

**Spec:** 2026-11-09のUI注釈1〜10、docs/spec.md・docs/design.mdと採用済み紙面。

## Decisions

- カードに「場所の概要」「おすすめの理由」を別々に表示する。既存descriptionの既知デモ注記を紙面上だけ除き、最大120文字の概要にする。未訪問の理由は既存reason、訪問済みは思い出を選んだことと同行者/スタイルを使う。施設/営業時間/移動距離などを作らない。コメントの保存値は維持し、空欄の理由を二重に表示しない。
- 招待文欄とテキストコピー・PNGボタンをPC/スマホとも削除し、不要になった画面処理も除去する。サーバーの既存invitationフィールドは互換性のため保持する。下段は訪問順/思い出の2列、スマホは1列。
- 編集側のプレビュー入口を「しおりを見る」、閲覧側見出しを「旅のしおり」にする。「モデルプラン」は「おすすめの訪問順」。
- 共有パネルの説明2段落と常設URL欄を削除する。ボタンは保存済みのcompanionから「{相手}を誘う」、一人なら「しおりを共有する」。同じURLの発行/再開とコピーを維持する。Clipboard失敗時だけブラウザのコピー用ダイアログでURLを示す。公開停止・表示回数は維持する。
- クーポンラベルはプレゼントアイコン＋文字を併記し、訪問順リストでは幅を文字に合わせて右寄せにする。非所有者への非表示を変更しない。

## Tasks

- [x] shared/spot-copy.tsとApp.tsxへ概要/推薦理由、招待文/コピー/PNG除去、閲覧/訪問順ラベルを反映。
- [x] SharePanel.tsx・sharing.cssへ相手別ボタンと表示整理、SpotDetailDialog.tsx・styles.cssへアイコン/右寄せと2列/固定バーを反映。
- [x] spec/design/README/verificationを更新し、build・Hidden再起動・HTTP参照・ステージ内容確認・コミット。

反映根拠: Node 26.13.0 / pnpm 11.25.0のbuildは終了コード0。3001番の対象PID 32812のみ同定・停止しHidden PID 34380で起動。GET / と /api/health は200、新JSはindex-DO9kJDg1.js。追加テスト・レビューは未実施。DB変更なし。詳細はdocs/verification.md。

## Future verification focus (not executed)

- 全同行者と一人旅、公開中/停止中/未保存時の招待URL操作、Clipboard失敗と再送。
- 概要/推薦理由の空値・Unicode・長文、既存コメント保持、共有ページの非所有者クーポン非表示。
- PC/スマホの2操作バー、2列/1列紙面、クーポン右寄せ、既存編集・写真・クーポン/共有計測。
