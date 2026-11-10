# 技術と検証環境

2026-11-10 文書更新。アプリの動作に必要なのはNode.js 26とPostgreSQL。Python、imagegen、指定スキルは制作・レビュー用で、アプリの実行依存ではない。以下の環境・ハッシュの確認記録は2026-11-09のもので、今回再検証した結果ではない。

|用途|採用|理由・境界|
|---|---|---|
|画面|React 19 / TypeScript / Vite 8|SPAで直接編集とテンプレート切替。通常のテキスト描画を使用。|
|API|Node.js 26 / Express 5 / Zod 4|共有型、明示的入力契約、ローカル127.0.0.1のみ。|
|分析連携|@modelcontextprotocol/sdk 1.32.2|公式SDKのStreamable HTTP。町管理者専用キーで匿名集計を読み取り。外部AI API呼び出しなし。|
|永続化|PostgreSQL 17 / pg|利用者分離、UNIQUE、行ロック、revision、migration。SQLite等への代替なし。|
|画像|Multer 2 / Sharp 0.35|MIMEとmagicに加えて実デコード。再変換してmetadataを除去。|
|CSV|csv-parse 7|BOM・引用符・改行列を扱い、取込前にキーと欠損を検証。|
|共有|共有URL / Clipboard API|保存済みの掲載内容・選択した思い出を同じローカルアプリで閲覧。共有写真は対象範囲を照合するAPIで配信し、外部ストレージへ送信しない。|
|検証|Vitest 5 / Playwright 1.65 / Edge|実DB統合、ブラウザ一筆書き、ローカルダウンロード。|

正確な依存バージョン・解決先は `pnpm-lock.yaml`。pnpm自体は11.25.0、直接依存は移行前のnpm lockfileで解決済みだった版へ正確に固定し、通常導入は `pnpm install --frozen-lockfile --ignore-scripts` とする。依存build scriptを実行する場合の許可は `pnpm-workspace.yaml` で現在の `esbuild@0.28.2` だけへ限定する。npm管理時にはWindows x64のSharpが配布済みoptional binaryで動くことを別の空ディレクトリで確認済み。pnpm移行後の確認範囲は [検証記録](verification.md) に分離する。

招待文欄・招待文コピー・PNG保存の操作は現行UIから削除済み。過去のPNG出力記録を現在の機能説明へ流用しない。共有URL・写真の公開範囲とキャッシュは [仕様](spec.md) を参照する。

## 検証環境の位置づけ

記録上の環境はWindows x64、Node.js 26.13.0、pnpm 11.25.0、PostgreSQL 17.11。PC/スマホ検証はEdgeのheadless実行で、スマホ実機の検証ではない。端末固有のDB名・ポート・保存先は開発担当者向けの [内部環境記録](internal/environment.md) へ分離する。テストの対象版と実施範囲は [検証記録](verification.md) を参照する。

## 配布元とアーカイブSHA256

|配布物|公式取得先|確認したSHA256|
|---|---|---|
|Node 26.13.0 Windows x64 ZIP|https://nodejs.org/dist/v26.13.0/node-v26.13.0-win-x64.zip|dcc60d59a0746999f99064a01c020445d54d84228c691cdbf25b49ac3b59150a|
|PostgreSQL 17.11 Windows x64 ZIP|https://get.enterprisedb.com/postgresql/postgresql-17.11-1-windows-x64-binaries.zip|6eabdf00d2893713b75db4336a23c3fdf505f056e217ec6e2e95d901750cfea3|
|Python 3.13.12 embeddable ZIP|https://www.python.org/ftp/python/3.13.12/python-3.13.12-embed-amd64.zip|76f238f606250c87c6beac75dccd35ee99070a13490555936abb6cb64ecce3d0|

Nodeは公式SHASUMS、Pythonは公式release情報と照合した。PostgreSQL欄は公式URLから取得したアーカイブのローカル測定値であり、第三者署名の検証を主張しない。ZIP・展開ランタイム・DB・依存キャッシュはGitへ含めない。

## 実行時の制限

固定コード1111とローカルHTTPはデモ用。実サービスの本人確認・TLS・運用監視・災害復旧システムを実装したものではない。Docker Compose設定は同梱するが、この端末ではDockerを使った再現を実行していない。動作確認済み経路はREADMEのWindowsローカルPostgreSQL経路である。
