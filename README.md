# 今度はあなたと

旅の思い出を、次の約束に。

地域のスタンプラリーで訪れた場所を振り返り、次に誰かを誘うための「招待メッセージ付き旅のパンフレット」を作るローカルWebアプリです。メールでログインすると、訪問履歴とアンケートから初回だけ自動生成・DB保存します。保存済みなら編集内容を維持して復元します。

## 必要環境

- **Node.js 26**（`.nvmrc` / `engines`に明記）。検証には26.13.0を使用。
- PostgreSQL 17以降。Docker Compose、または通常のローカルPostgreSQLで動きます。
- 初回のnpm依存取得にはインターネットが必要。起動後の生成・写真・共有にはクラウド／外部AI／SMTPは不要です。
- npmロックファイルを同梱。画像素材も `public/assets` に同梱しています。

Node 26が未導入なら、[公式Node.js 26.13.0配布](https://nodejs.org/dist/v26.13.0/)からOSに合う配布物を取得してください。Windowsでは `node-v26.13.0-win-x64.zip` を `.tools` へ展開すれば、システムのNodeを変更せず使えます。

```powershell
# ZIPを .tools/node-v26.13.0-win-x64 に展開済みの場合
$env:Path = (Join-Path $PWD '.tools\node-v26.13.0-win-x64') + ';' + $env:Path
node --version   # v26.13.0（26系を使用）
```

Pythonはアプリの起動には不要です。導入済みUIスキルの検索を使う場合だけ使用します。採用技術・配布元・検証したアーカイブのハッシュは [技術資料](docs/technology.md) に記載しています。

**固定コード1111はローカルデモ専用です。アプリとDBは127.0.0.1へ限定し、インターネットやLANへ公開しないでください。**

## 最短起動（Dockerを使う場合）

プロジェクトルートで実行します。

以下はWindows PowerShell用の例です。実行ポリシーにより `npm.ps1` が止められる場合は、各コマンドの `npm` を `npm.cmd` に置き換えてください（例: `npm.cmd ci --ignore-scripts`）。Node公式ZIPには両方が同梱され、`npm.cmd` の使用に恒久的なポリシー変更は不要です。

```powershell
node --version
npm ci --ignore-scripts
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d --wait db
npm run db:migrate
npm run db:seed
npm run build
npm start
```

[http://127.0.0.1:3001](http://127.0.0.1:3001) を開きます。通常停止はアプリのCtrl+Cと `docker compose stop`。DBボリュームは残すので編集が保持されます。`docker compose down -v` はデータを消すため、通常停止には使用しません。

`.env` の初期値はローカルデモ用の既知の認証情報です。既存PostgreSQLを使う場合は、専用DB `kondo_anatato` を作り、`DATABASE_URL` を変更してください。他のDBへmigrationを実行しないでください。

## Windows・Dockerなしでの起動

[EDBの公式PostgreSQLバイナリ](https://www.enterprisedb.com/download-postgresql-binaries)の17系Windows x64を取得・展開し、binディレクトリを指定します（検証版17.11の[配布ZIP](https://get.enterprisedb.com/postgresql/postgresql-17.11-1-windows-x64-binaries.zip)）。管理者権限やWindowsサービス登録は不要です。先に上記のNode 26を有効にしてください。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows-db.ps1 -Action start -PostgresBin C:\path\to\pgsql\bin
$env:DATABASE_URL = 'postgres://postgres@127.0.0.1:55432/kondo_anatato'
npm ci --ignore-scripts
npm run db:migrate
npm run db:seed
npm run build
npm start
```

以後も同じ `DATABASE_URL` を指定します（または `.env` に記載）。この補助スクリプトは `.local/pgdata` に専用DBを初期化し、127.0.0.1:55432だけで起動します。信頼認証は単独端末のデモ専用です。通常運用向けにはパスワード認証のDocker版を使用してください。

`-ExecutionPolicy Bypass` は内容を確認した同梱スクリプトを、その子プロセス内だけで実行する指定です。Windowsの恒久設定やレジストリは変更しません。スクリプト本文はWindows PowerShell 5.1でも読めるASCIIで記述しています。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows-db.ps1 -Action status -PostgresBin C:\path\to\pgsql\bin
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows-db.ps1 -Action stop -PostgresBin C:\path\to\pgsql\bin
```

停止・再開は既存データを削除しません。`.tools` のランタイムや `.local` の実DBはGitへ含めません。

## デモの一筆書き

|用途|メール|コード|
|---|---|---|
|通常デモ|`demo@example.test`|`1111`|
|別利用者・混在防止の確認|`second@example.test`|`1111`|
|訪問履歴なし|`no-history@example.test`|`1111`|

1. 通常デモでログイン。生成ボタンを押さずに、初回だけパンフレットを生成・保存します。
2. 「前回の思い出」と番号付き訪問候補を確認。感想を入力し、写真を追加します。
3. 「旅の条件を変更」で再訪したい場所、同行者、日帰り／一泊二日、ゆっくり／アクティブを選択し、再生成します。
4. 個別候補の変更・除外・追加、訪問順、印象スポット、テンプレートを調整し「変更を保存」。
5. 再読み込み／ログアウト・再ログインで復元を確認します。
6. 「招待文をコピー」でLINE等へ貼り付け。「PNGで保存」で写真・感想入りの現在のテンプレートを端末へ保存します。

写真は追加・差し替え・削除時に個別保存します。コメント・候補・条件・テンプレートは明示保存です。保存に失敗しても画面の入力は保持され、再試行できます。未保存状態で画面を閉じると警告しますが、強制終了した場合の未保存入力は復元しません。

保存に失敗した写真も、同じ編集画面内で候補を外して戻す・再生成する操作をまたいで保持します。再読み込みやログアウトをする前に、写真の再試行を完了してください。

## 提供CSVの取り込み

元データは読み取り専用です。リポジトリへコピーしません。

```powershell
npm run data:inspect -- C:\AI-Sprint\sample-data
npm run data:import -- C:\AI-Sprint\sample-data --with-demo-aliases
```

提供データの全500件のメールはマスク済み同一値のため、メール照合には使用できません。`--with-demo-aliases` を明示すると `sample@example.test`（実績あり）と `sample-empty@example.test`（実績なし）を匿名利用者へ対応付けます。これはデモ用の仮メールであり、実メールや訪問履歴を補完・推測しません。

取り込み後、同じ `DATABASE_URL` で起動したアプリに対して件数と履歴なし動作を確認できます。別ポートで起動した場合は `E2E_BASE_URL` をそのURLへ変更します。

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:3001'
npm run data:verify
```

デモfixtureと取り込みデータはID名前空間で分離します。500人・2,629スタンプ履歴・287参加後回答を取り込み、登録時属性・氏名・LINE情報はDBへ保存しません。特典履歴の集計不一致は補完せず、中心機能には使用しません。再投入はファイルハッシュで冪等です。列・件数・欠損・境界の詳細は [取り込み資料](docs/data-import.md)。

## 写真・データの保存と復旧

- 写真保存先は `UPLOAD_DIR`（既定 `uploads`）。1枚5MBまで、JPEG/PNG/WebP、縦横6000px以内・2400万画素以内の静止画。サーバーでWebPに再変換しEXIF/GPSを除去します。
- 写真は認可付きAPIから配信します。DBに実体は保存せず、乱数ファイル名の参照だけを保持します。外部アップロードはありません。
- DBと `UPLOAD_DIR` を**一組で**バックアップ・復元してください。DBのみ復元すると追加写真が欠損します。
- 同梱の生成画像は `public/assets`。Gitからの再取得で復元できます。ユーザー追加画像やDBを上書きしません。
- migrationは `db/migrations` と `schema_migrations` で管理。`db:migrate` / `db:seed` は既存冊子・編集を削除しません。全初期化が必要なら専用の空DBを別名で作り、URLを切り替えてmigration/seedしてください。
- `Password.txt.txt` 等の既存秘密ファイル、`.env`、写真、元CSV、DBデータはGit対象外です。

## 開発・検証

```powershell
npm run dev
npm run check
npm test
```

開発画面は [http://127.0.0.1:5173](http://127.0.0.1:5173)、APIは3001。5173が使用中なら、空きポートへの自動切替はせず明示エラーになります。別ポートを使う場合はvite設定と `WEB_ORIGIN` の両方を一致させてください。

DB統合テストは一時schemaを作成・破棄します。専用検証DBを推奨します。

```powershell
$env:TEST_DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5432/kondo_anatato'
npm test
node node_modules/playwright/cli.js install chromium
# build/start済みのアプリを別ターミナルで起動してから実行
npm run test:e2e
```

`TEST_DATABASE_URL` がない場合、DB統合テストはskipとして明示されます。PCとスマホのブラウザテストはローカルPNGダウンロードまで検証します。実行結果と残存リスクは [検証記録](docs/verification.md) と [セキュリティ監査](docs/security.md)。

Windowsのブラウザテストはインストール済みMicrosoft Edge、他OSはPlaywright Chromiumを既定にします。`PLAYWRIGHT_CHANNEL=chromium` などで切替可能です。この端末ではEdgeでPC/スマホを検証しました。

E2Eはデモ利用者の保存内容を変更します。自分のデモ編集を残す場合は、空の専用検証DBと別の `UPLOAD_DIR` を指定して別ポートで起動してください。DBと保存先を揃えたうえで、`E2E_BASE_URL` をそのURLへ設定します。テスト結果は `test-results` に出力し、Gitへ含めません。依存監査は `npm audit`、スキルの同梱ファイル検証は `node scripts/skill-inventory.mjs`。

2026-11-09の検証ではNode 26.13.0／PostgreSQL 17.11／Edgeで、単体・DB統合46件とPC・スマホE2E8件、型チェック・buildが合格し、開発依存を含むnpm auditは0件でした。Docker構成は未実行です。実機スマホと正式Cloudflare完全監査の未検証範囲は [検証記録](docs/verification.md) を参照してください。

## 資料

[仕様](docs/spec.md) / [デザイン](docs/design.md) / [DB・API](docs/database.md) / [取り込み](docs/data-import.md) / [技術](docs/technology.md) / [画像素材](docs/assets.md) / [指定スキル](docs/skills.md) / [セキュリティ](docs/security.md) / [検証](docs/verification.md) / [評価対応](docs/evaluation.md)
