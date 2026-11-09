# 今度はあなたと

旅の思い出を、次の約束に。

地域のスタンプラリーで訪れた場所を振り返り、誰かと一緒にいく「次の旅のしおり」を作るローカルWebアプリです。メールでログインし、初回は思い出のスポットと旅の条件を選んで生成・DB保存します。保存済みなら編集内容を維持して復元します。

## 必要環境

- **Node.js 26**（`.nvmrc` / `engines`に明記）。検証には26.13.0を使用。
- **pnpm 11.25.0**（`packageManager` / `engines`に固定）。互換範囲や`latest`ではなく、この版を使用。
- PostgreSQL 17以降。Docker Compose、または通常のローカルPostgreSQLで動きます。
- 初回のpnpm依存取得にはインターネットが必要。起動後の生成・写真・共有にはクラウド／外部AI／SMTPは不要です。
- `pnpm-lock.yaml` を同梱。直接依存とpnpm自体も正確な版へ固定し、画像素材も `public/assets` に同梱しています。

Node 26が未導入なら、[公式Node.js 26.13.0配布](https://nodejs.org/dist/v26.13.0/)からOSに合う配布物を取得してください。Windowsでは `node-v26.13.0-win-x64.zip` を `.tools` へ展開すれば、システムのNodeを変更せず使えます。

```powershell
# ZIPを .tools/node-v26.13.0-win-x64 に展開済みの場合
$env:Path = (Join-Path $PWD '.tools\node-v26.13.0-win-x64') + ';' + $env:Path
node --version   # v26.13.0（26系を使用）
pnpm --version   # 11.25.0（固定版を使用）
```

Pythonはアプリの起動には不要です。導入済みUIスキルの検索を使う場合だけ使用します。採用技術・配布元・検証したアーカイブのハッシュは [技術資料](docs/technology.md) に記載しています。

**固定コード1111はローカルデモ専用です。アプリとDBは127.0.0.1へ限定し、インターネットやLANへ公開しないでください。**

## 最短起動（Dockerを使う場合）

プロジェクトルートで実行します。

以下はWindows PowerShell用の例です。実行ポリシーにより `pnpm.ps1` が止められる場合は、各コマンドの `pnpm` を `pnpm.cmd` に置き換えてください（例: `pnpm.cmd install --frozen-lockfile --ignore-scripts`）。実行ポリシーを恒久変更する必要はありません。

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile --ignore-scripts
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d --wait db
pnpm run db:migrate
pnpm run db:seed
pnpm run build
pnpm start
```

[http://127.0.0.1:3001](http://127.0.0.1:3001) を開きます。通常停止はアプリのCtrl+Cと `docker compose stop`。DBボリュームは残すので編集が保持されます。`docker compose down -v` はデータを消すため、通常停止には使用しません。

`.env` の初期値はローカルデモ用の既知の認証情報です。既存PostgreSQLを使う場合は、専用DB `kondo_anatato` を作り、`DATABASE_URL` を変更してください。他のDBへmigrationを実行しないでください。

## Windows・Dockerなしでの起動

[EDBの公式PostgreSQLバイナリ](https://www.enterprisedb.com/download-postgresql-binaries)の17系Windows x64を取得・展開し、binディレクトリを指定します（検証版17.11の[配布ZIP](https://get.enterprisedb.com/postgresql/postgresql-17.11-1-windows-x64-binaries.zip)）。管理者権限やWindowsサービス登録は不要です。先に上記のNode 26を有効にしてください。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows-db.ps1 -Action start -PostgresBin C:\path\to\pgsql\bin
$env:DATABASE_URL = 'postgres://postgres@127.0.0.1:55432/kondo_anatato'
pnpm install --frozen-lockfile --ignore-scripts
pnpm run db:migrate
pnpm run db:seed
pnpm run build
pnpm start
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
|初回のパンフレット作成から試すdemo01|`demo01@example.test`|`1111`|
|別利用者・混在防止の確認|`second@example.test`|`1111`|
|訪問履歴なし|`no-history@example.test`|`1111`|

`demo01` は `db:seed` でデモ訪問履歴を用意し、パンフレットは作成しません。初回ログインで生成から始まり、2回目以降は保存済みの内容を復元します。`db:seed` を再実行しても作成済みの冊子や編集はリセットしません。

1. 初回のデモでログイン。訪問スポットは未選択で始まります。見せたい思い出を1件以上選び、旅の条件を決めて「この内容で次の旅をつくる」を押します。保存済みなら冊子をそのまま復元します。
2. 「みる・あそぶ・たべる・いやす・かう」のピックアップと「前回の思い出」を確認。感想を入力し、写真を追加します。
3. 「旅の条件を変更」で再訪したい場所、同行者、日帰り／一泊二日、ゆっくり／アクティブを選択し、再生成します。
4. 各カテゴリの個別変更、モデルプランの順序、印象スポット、テンプレートを調整し「変更を保存」。
5. 再読み込み／ログアウト・再ログインで復元を確認します。
6. 「招待文をコピー」でLINE等へ貼り付け。「PNGで保存」で写真・感想入りの現在のテンプレートを端末へ保存します。

写真は追加・差し替え・削除時に個別保存します。コメント・候補・条件・テンプレートは明示保存です。保存に失敗しても画面の入力は保持され、再試行できます。未保存状態で画面を閉じると警告しますが、強制終了した場合の未保存入力は復元しません。

保存に失敗した写真も、同じ編集画面内で候補を外して戻す・再生成する操作をまたいで保持します。再読み込みやログアウトをする前に、写真の再試行を完了してください。

## 提供CSVの取り込み

元データは読み取り専用です。リポジトリへコピーしません。

```powershell
pnpm run data:inspect C:\AI-Sprint\sample-data
pnpm run data:import C:\AI-Sprint\sample-data --with-demo-aliases
```

提供データの全500件のメールはマスク済み同一値のため、メール照合には使用できません。`--with-demo-aliases` を明示すると `sample@example.test`（実績あり）と `sample-empty@example.test`（実績なし）を匿名利用者へ対応付けます。これはデモ用の仮メールであり、実メールや訪問履歴を補完・推測しません。

取り込み後、同じ `DATABASE_URL` で起動したアプリに対して件数と履歴なし動作を確認できます。別ポートで起動した場合は `E2E_BASE_URL` をそのURLへ変更します。

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:3001'
pnpm run data:verify
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
pnpm run dev
pnpm run check
pnpm test
```

開発画面は [http://127.0.0.1:5173](http://127.0.0.1:5173)、APIは3001。5173が使用中なら、空きポートへの自動切替はせず明示エラーになります。別ポートを使う場合はvite設定と `WEB_ORIGIN` の両方を一致させてください。

DB統合テストは一時schemaを作成・破棄します。専用検証DBをあらかじめ作成して指定してください。以下の `kondo_test` は通常デモDBと別のDBです。

```powershell
$env:TEST_DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5432/kondo_test'
pnpm test
pnpm exec playwright install chromium
# build/start済みのアプリを別ターミナルで起動してから実行
pnpm run test:e2e
```

`TEST_DATABASE_URL` がない場合、DB統合テストはskipとして明示されます。PCとスマホのブラウザテストはローカルPNGダウンロードまで検証します。実行結果と残存リスクは [検証記録](docs/verification.md) と [セキュリティ監査](docs/security.md)。

Windowsのブラウザテストはインストール済みMicrosoft Edge、他OSはPlaywright Chromiumを既定にします。`PLAYWRIGHT_CHANNEL=chromium` などで切替可能です。この端末ではEdgeでPC/スマホを検証しました。

E2Eはデモ利用者の保存内容を変更します。自分のデモ編集を残す場合は、空の専用検証DBと別の `UPLOAD_DIR` を指定して別ポートで起動してください。DBと保存先を揃えたうえで、`E2E_BASE_URL` をそのURLへ設定します。テスト結果は `test-results` に出力し、Gitへ含めません。依存監査は `pnpm audit`、スキルの同梱ファイル検証は `node scripts/skill-inventory.mjs`。

2026-11-09の明示依頼による再検証では、Node 26.13.0／pnpm 11.25.0で型チェック・build、専用DBの単体・API統合57件が成功し、依存監査は指摘0件でした。PC/スマホE2Eは既存14件とPNG追加2件が合格。スマホPNGの修正前後の目視結果と、並行更新中に固定した検証対象は [最新の検証記録](docs/verification.md#明示依頼による現在版の再検証2026-11-09) を参照してください。Docker構成、実機スマホ、正式Cloudflare完全監査は今回実施していません。

## 町側管理画面

`pnpm run db:migrate` で追加migrationと町デモアカウントを登録後、`town@example.test` / `1111` でログインしてください。同じログイン画面から町側の「概況」「スポット管理」「パンフレット登録状況」「来訪履歴（クーポン利用）」が開きます。`source=organizer` の一般利用者に管理権限は付きません。

スポットは追加・編集・公開停止／再開でき、画像は同梱イメージか1枚5MB以内のJPEG/PNG/WebPを使えます。公開停止でも過去の履歴・掲載は保持します。新規スポットは既存冊子を再生成すると候補へ追加されます。名称・説明・公式画像は既存冊子へも反映され、使用中カテゴリに必要なタグ削除は拒否します。カタログseedの再実行は町の編集を上書きしません。

登録状況は匿名IDと件数・日時だけを表示し、利用者のメール・氏名・写真実体・コメント本文は表示しません。「共有状況」は追加依頼により実装し、共有URLの発行数・公開中数・累計表示回数と匿名一覧を表示します。町側には生URLや共有写真・コメント本文を返しません。固定コードは町側もローカルデモ専用です。

町側のテスト・レビュー後の修正では、専用DBの単体・API統合57件、PC/スマホE2E16件が合格しました。写真競合後の復旧、登録再送の冪等性、カテゴリ保存・復元、スマホPNGの欠けを修正済みです。[町側の最終検証結果と範囲](docs/town-admin-verification.md)を参照してください。

スポットの「クーポンあり」をオンにして保存すると、利用者のパンフレット・プレビュー・スポット一覧にラベルを表示します（設定後は利用者画面を再読み込み）。パンフレットのスポット名・写真を選ぶと詳細が開き、編集画面では「クーポンを表示する」→英数字6桁コードと再利用不可の確認→「使う」で一度だけ記録します。コード表示・キャンセルだけでは計測しません。コードは同じ利用者・スポットで固定、使用済みは日時を表示し、提供の再開後も再利用できません。既存の設定・受取履歴は維持します。QRは使用しません。

来訪履歴は本人のクーポン利用申告として件数・人数・匿名履歴を表示し、CSVのスタンプ実績へは加算しません。このスポット詳細・クーポン追加差分はbuild・DB反映・HTTP配信確認のみを実施し、上記57件/16件の合格範囲には含みません。追加の機能テスト・画面目視・レビューは未実施です。

## シェア用URL

1. 編集を保存して「プレビュー」を開き、「シェア用URLをコピー」を押します。保存済みの掲載内容・選択した思い出・写真・コメントを共有します。未保存編集や写真処理中/失敗時は、先に保存を完了してください。
2. URLを開くと、ログインなしで紙面とスポット詳細を閲覧できます。以後の保存も同じURLへ反映されます。アンケート・未掲載データ・アカウント情報は共有しません。
3. プレビューの表示回数は「件数を更新」で参照し、公開を止める場合は「公開を停止する」を押します。再開は同じURLで、累計件数も保持します。クリップボードが使えない場合はURL欄を選択して手動コピーできます。

表示回数は共有ページの本文を表示したときに記録し、再読み込みを含みます。画像取得・作者のプレビュー・コピーは含まず、同じ表示記録の再送は二重加算しません。作者が共有URLそのものを開く場合は含みます。閲覧人数・実来訪人数ではありません。

クーポンのラベル・表示/利用ボタンは、冊子を作成した本人がログインしている場合だけ表示します。未ログイン・別利用者・町アカウントには共有APIでもクーポン情報を返しません。写真は共有URLと掲載範囲を照合するAPIで配信し、静的公開フォルダーへ移動しません。

サーバーは従来どおりローカル限定です。`127.0.0.1` の共有URLは、このアプリを動かしている端末向けで、別端末・インターネットへの公開機能ではありません。共有URLの追加差分も追加テスト・レビューは未実施で、従来の合格範囲へ含めません。

## 資料

[仕様](docs/spec.md) / [デザイン](docs/design.md) / [DB・API](docs/database.md) / [取り込み](docs/data-import.md) / [技術](docs/technology.md) / [画像素材](docs/assets.md) / [指定スキル](docs/skills.md) / [セキュリティ](docs/security.md) / [検証](docs/verification.md) / [評価対応](docs/evaluation.md)
