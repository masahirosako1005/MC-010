# 技術と検証環境

2026-11-09。アプリの動作に必要なのはNode.js 26とPostgreSQL。Python、imagegen、指定スキルは制作・レビュー用で、アプリの実行依存ではない。

|用途|採用|理由・境界|
|---|---|---|
|画面|React 19 / TypeScript / Vite 8|SPAで直接編集とテンプレート切替。通常のテキスト描画を使用。|
|API|Node.js 26 / Express 5 / Zod 4|共有型、明示的入力契約、ローカル127.0.0.1のみ。|
|永続化|PostgreSQL 17 / pg|利用者分離、UNIQUE、行ロック、revision、migration。SQLite等への代替なし。|
|画像|Multer 2 / Sharp 0.35|MIMEとmagicに加えて実デコード。再変換してmetadataを除去。|
|CSV|csv-parse 7|BOM・引用符・改行列を扱い、取込前にキーと欠損を検証。|
|共有|Clipboard API / html-to-image|文字列コピーと端末内PNG。公開共有先や外部ストレージなし。|
|検証|Vitest 5 / Playwright 1.65 / Edge|実DB統合、ブラウザ一筆書き、ローカルダウンロード。|

正確な依存バージョン・解決先は `package-lock.json`。既定のパッケージスクリプトによる未確認処理を避け、`npm ci --ignore-scripts` で導入した。Windows x64のSharpは配布済みoptional binaryで動き、別の空ディレクトリでも同コマンドによる導入とPNGのデコード／エンコードを確認した。

## この端末の実環境

- Windows x64、Node.js **26.13.0**、PostgreSQL **17.11**。
- PlaywrightのPC/スマホともMicrosoft Edge **157.0.4341.42**のheadless実行。スマホはiPhone 13相当390×844のエミュレーションで、実機Safariではない。
- PostgreSQLは `.tools/pgsql` の公式配布バイナリ。専用clusterは `.local/pgdata`、127.0.0.1:55432。Windowsサービス登録なし。
- DB補助スクリプトの初期化・起動・状態確認・通常停止は、別の空clusterを55433番へ作って確認。Windows PowerShell 5.1の文字コード差を避けるため本文をASCIIとした。
- 通常デモDBは `kondo_anatato`。最終再現には別の空DB `kondo_final_verify_20261109` と `.local/final-verify-uploads`、アプリ3003番を使用。既存の編集は消していない。
- システムNodeの置換やグローバルスキル導入は行わず、各コマンドのPATHだけへローカルNodeを追加。Python補助キャッシュの例外は [スキル記録](skills.md) に記載。

## 配布元とアーカイブSHA256

|配布物|公式取得先|確認したSHA256|
|---|---|---|
|Node 26.13.0 Windows x64 ZIP|https://nodejs.org/dist/v26.13.0/node-v26.13.0-win-x64.zip|dcc60d59a0746999f99064a01c020445d54d84228c691cdbf25b49ac3b59150a|
|PostgreSQL 17.11 Windows x64 ZIP|https://get.enterprisedb.com/postgresql/postgresql-17.11-1-windows-x64-binaries.zip|6eabdf00d2893713b75db4336a23c3fdf505f056e217ec6e2e95d901750cfea3|
|Python 3.13.12 embeddable ZIP|https://www.python.org/ftp/python/3.13.12/python-3.13.12-embed-amd64.zip|76f238f606250c87c6beac75dccd35ee99070a13490555936abb6cb64ecce3d0|

Nodeは公式SHASUMS、Pythonは公式release情報と照合した。PostgreSQL欄は公式URLから取得したアーカイブのローカル測定値であり、第三者署名の検証を主張しない。ZIP・展開ランタイム・DB・依存キャッシュはGitへ含めない。

## 実行時の制限

固定コード1111とローカルHTTPはデモ用。実サービスの本人確認・TLS・運用監視・災害復旧システムを実装したものではない。Docker Compose設定は同梱するが、この端末ではDockerを使った再現を実行していない。動作確認済み経路はREADMEのWindowsローカルPostgreSQL経路である。
