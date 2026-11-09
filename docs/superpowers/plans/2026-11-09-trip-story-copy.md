# Trip Story Copy Implementation Plan

> **For agentic workers:** writing-plans / executing-plansで現在セッションにて実装する。ユーザーの6件＋作成中文言＋追加4件をまとめて反映。AGENTS.mdに従い追加テスト・レビューは実行せず、build・対象アプリのHidden再起動・最小HTTP参照のみを行う。

**Goal:** 思い出から次の旅のしおりをつくる流れを文言とタイトルで明確にし、初回の選択を利用者自身に委ねる。

**Architecture:** 既存React画面とCSS、決定的なタイトル生成ルールを変更する。DB schema/API payloadは変更せず、旧生成タイトルだけを読取時に新しい表示へ変換する。写真・コメント・共有URL・クーポン履歴は変更しない。

**Tech Stack:** TypeScript / React / Node 26 / PostgreSQL、追加依存なし。

**Spec:** 2026-11-09ブラウザ注釈。作成中見出しはユーザー回答「旅の思い出から、次の旅のしおりをつくっています」。採用済み画像とdocs/spec.md・docs/design.mdを継承。

## Decisions

- ログイン説明は「前回の旅の思い出から、誰かと一緒にいく次の旅のしおりを作ります。」。
- 初回（冊子なし）は訪問済みチェックをすべてオフ。既存冊子の条件変更はisMemoryの選択を復元し、同行者・日数・スタイルも維持。1件以上の明示選択は引き続き必要。
- スポット特徴は既存descriptionの最初の文からUnicode40文字までを表示。空なら既存タグを表示し、説明本文や元データを変更しない。
- 選択案内は黄色背景・オレンジ線・太い文字とアイコンで強調し、複数選択可を別行にする。「どんな旅にしたい」「この内容で次の旅をつくる」を採用。
- ローカルの同行者別定型で少し情緒あるタイトルにする。パートナーは「あの日の続き、今度はふたりで」。一人旅には勧誘表現を含めない。日数・スタイルは既存の旅情報で示す。
- 既存保存値が従来の自動生成タイトルと一致する場合だけ、API返却時に新表現へ置換する。異なる保存タイトルは保持し、読取だけでDBを更新しない。作成/明示保存/再生成では新タイトルを保存する。
- ヘッダーに前回の思い出から生まれたことを明記し、選択した思い出のスポット名を最大2件＋残件数で補足する。カードの区分は「前回の思い出」「新しい体験」。共通紙面なので共有・PNGにも反映する。

## Tasks

- [x] shared/brochure-copy.ts、server/generator.ts・brochures.tsへ新規/既存のタイトルルールを反映。
- [x] TripSettingsScreen.tsx・trip-settings.cssへ未選択初期値、短文、選択案内強調、ラベル/CTAを反映。
- [x] App.tsx・styles.cssへログイン/生成/ヘッダーの由来とカード区分を反映。
- [x] spec/design/database/README/verificationを更新し、build・Hidden再起動・HTTP確認・コミット。

反映根拠: Node 26.13.0 / pnpm 11.25.0でbuildが終了コード0。3001番の対象PID 11676のみ同定・停止しHidden PID 32812で起動。GET / と /api/health は200、新JSはindex-BeXDbb6l.js。追加テスト・レビューは未実施。DB schema変更なし。詳細はdocs/verification.md。

## Later verification focus (not executed)

- 初回0件から1件/複数件の選択、0件送信拒否、既存isMemoryと写真・コメント保持。
- 旧生成タイトル/独自タイトル、全同行者、共有・PNGの由来表示と長いタイトル/スポット名。
- 短文のUnicode・空説明・長文、狭幅の選択案内/CTA/ヘッダー、最低3秒の生成表示。
