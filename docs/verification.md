# 最終検証記録

> 開発・検証担当者向けの履歴。各項目の対象版・実施日・範囲に限った結果であり、過去の合格を後続変更へ引き継がない。一般公開資料には必要な結果を要約し、端末固有の情報や画面証跡を一括同梱しない。配布方針は [資料案内](README.md)、監査の経緯は [監査資料案内](audits/README.md) を参照する。

## 2026-11-10 マップ風の「旅の全体像」

ユーザーが戻した写真一覧版の削除を維持し、同じ位置へ新しい `TripMap` を追加した。内蔵imagegenで添付画像を参照した文字なしの水彩背景を生成し、同梱WebPへ変換（1440×1080、610,846 bytes）。背景の生成画像は目視した。番号ピン・カテゴリラベルと点線はReact/SVGで表示し、現在の訪問順と連動させる。スポット名・短い紹介文を併記し、ピン・紹介欄から既存の詳細を開く。背景は図案であり、実際の地理・経路を示すものではない。DB・API・利用者写真の保存先は変更していない。

Node 26.13.0・固定pnpm 11.25.0でbuildが終了コード0（1,594 modules）。JSは `index-8UH8j-T1.js`、CSSは `index-CV4Mp7tV.css`。3001番の本プロジェクトのNode実体・起動引数・待受を同定し、PID 7392だけを停止してHidden再起動（PID 16244）。最小HTTP参照の `/api/health` と `/` は200で、アプリ名・新しいJS/CSS参照・待受PIDを確認。背景WebPへのHEADは200 / image/webp。DB・別アプリは停止していない。既存のデモ・共有・公開キャッシュ等の未コミット変更を含む作業ツリーでビルドし、この変更のコミットへは含めない。

AGENTS.mdに従い、追加のcheck・単体/API統合テスト・E2E・audit・skill inventory・アプリ画面の目視/操作・独立レビューは未実施。ピン位置の見え方・スマホ操作・訪問順変更・共有・印刷は動作未検証であり、背景画像の確認やbuild/HTTP応答をアプリの機能合格とはしない。

## 2026-11-10 紙面の旅情報をテーマだけに整理

ブラウザ注釈に従い、紙面ヘッダーから「旅の相手」「日程」を外し、「旅のテーマ」をオレンジの全幅の帯で表示する。編集・閲覧・共有・印刷の共通コンポーネントへ適用し、同行者・日数・スタイルの条件選択・保存・生成は維持する。

Node 26.13.0で固定pnpm 11.25.0のCLIを直接起動し、buildが終了コード0（1,592 modules）。JSは `index-BCBdgW7J.js`、CSSは `index-DkEq5HIO.css`。最初のビルドはランチャー内蔵Node 24の警告が出たため、Node 26を明示して再ビルドした。3001番の本プロジェクトのNode実体・起動引数・待受PIDを同定し、対象PID 14616だけを停止してHidden再起動（PID 1964）。最小HTTP参照の `/api/health` と `/` は200で、新しいJSの配信と待受PIDの一致を確認した。DBや別アプリは停止していない。

AGENTS.mdに従い、追加のcheck・単体/API統合テスト・E2E・audit・skill inventory・画面目視/操作・独立レビューは未実施。作業ツリーにある既存のデモ・共有関連変更を含む状態でビルドした。

利用者UI・共有・クーポンの最新結果は[しおり・共有・クーポンの追加検証](booklet-verification.md)。2026-11-09の明示依頼で、専用DBの単体/API71件、PC/スマホE2E20件、check・build・audit・skill inventory・CSV取込を確認した。以下の「未実施」は各変更を反映した当時の履歴であり、最新の範囲と区別する。

実施日: 2026-11-09（Asia/Tokyo）。基礎統合の確認版: `86e99a9`（取込 `8cb8b25`、UI `7f9d1de`、Windows起動 `126e6de`、Vite制限 `0757fb4`、レビュー修正 `b9ff878` を含む）。demo01追加後の追試も以下に記録する。

## 実行した検証

|確認|実行と結果|
|---|---|
|環境|Node 26.13.0 / PostgreSQL 17.11 / Edge 157.0.4341.42。詳細は [技術資料](technology.md)。|
|型|`npm run check` 成功。client/sharedとserverをTypeScriptで検査。|
|ビルド|`npm run build` 成功。サーバーJSとSPAを生成し、`npm start` から配信。|
|単体・DB統合|`TEST_DATABASE_URL` 指定の `npm test`。4ファイル・46件合格、skipなし。API10件を含む。|
|ブラウザ|`E2E_BASE_URL=http://127.0.0.1:3003 npm run test:e2e`。demo01追加後はPC5件＋スマホ5件、計10件合格、36.4秒。基礎版の初回空DB実行は8件合格。|
|依存監査|`npm audit --json`。prod/devを含み計0件。将来の脆弱性がない保証ではない。|
|固定スキル|`node scripts/skill-inventory.mjs`。286ファイル・23スキルのSHA256一致。公式3checkoutのHEADも固定SHAと一致。|
|依存再現|空の `.local/dependency-verify-final` にpackage/lockだけをコピーし、Node26で `npm ci --ignore-scripts`。SharpのPNG生成・デコード確認。|
|Windows DB起動|別の空クラスタで同梱windows-db.ps1のinit/start/status→migration/seed→stopが成功。demo01追加以前のfixture3人・4訪問を確認。追加後のseedは4人・6訪問。|
|開発サーバー|実Viteで画面とclient moduleを200、非秘密fixtureの.localとスキル領域を403と確認。ローカル専用領域をwatch対象から除外。|
|取込再現|空の専用DBでmigration→seed→inspect→import→再import→data:verify。件数・冪等性・欠損動作を確認。|

## 中心フローと境界

|要求|確認方法・結果|
|---|---|
|正常1111、未知利用者、コード不正|APIとPC/スマホ。全角1111はAPI400、0000は401、未知メールは404。セッション非発行。|
|初回自動表示・重複なし|空DBのE2Eでログインから自動表示。APIの並列ensureで冊子1件。再ログインは同じ冊子と編集を復元。|
|履歴なし|fixtureと取り込み別名の両方で案内。ensure422、冊子と訪問を生成しない。|
|利用者分離・IDOR|2利用者で他人itemへの写真追加・写真取得を404、他人item混入saveを400。所有者の編集を維持。|
|条件|家族・友人・一人、日帰り・一泊二日、ゆっくり・アクティブ、再訪先の複数選択と0件時エラーをブラウザ確認。全6同行者の入力は単体確認。|
|候補・順序・印象スポット|追加→除外→再追加、個別置換→戻す、前後入替、印象スポット変更、保存・再読込で復元。|
|200字|日本語199字＋絵文字1字を画面で200字として保存・復元。201字入力は画面で200字へ制限。ASCII/日本語/絵文字201字のAPI入力schema拒否も単体確認。|
|写真|正常アップロード・差替・削除・再取得。MIME偽装、SVG、5MB超、6001px、path traversal風ファイル名の統合検証。保存名はUUID.webp。|
|保存失敗|PUT503を模擬して入力を保持し再試行。写真503でもFileとblobプレビューをitem ID単位で保持し、候補の除外・再追加・再生成後も再選択なしで再試行成功。|
|再生成の保持|draftを送る再生成でコメント・写真・テンプレートを維持。候補除外・再追加でも保持。|
|招待文|実Clipboard APIでコピーを読取確認。一人用に勧誘表現がないことも確認。|
|PNG|両テンプレートを実ダウンロード。実画像を目視し、写真・コメント・順序を反映、編集UI・文字数・全体アンケートを除外。外部HTTP要求0件。|
|PC・スマホ|1440×900 / 390×844、追加で320×568・844×390・1024×768。横はみ出しなし。|
|キーボード・固定バー|モーダル初期focus、Shift+Tab循環、Escape、呼出しボタンへの復帰。写真再試行はPC/スマホともクリック成功し、次カードへの重なりを目視解消。動き軽減も有効にして確認。|
|履歴なし画面の通信失敗|logout503で案内を表示し、ログイン状態を保つ。解除後の再試行でログアウトして別メールを入力できる。|

追加写真に使ったのは同梱の架空イラスト。E2Eのメールはexample.testのfixtureだけで、証跡に元CSVの実値やユーザー写真を含めない。テスト用写真を実風景の正しい写真とは主張しない。

## 独立レビュー後の修正

最終差分を別担当が読み取りでレビュー。Criticalは0件。Important3件とMinor2件について、次を修正・検証した。

|指摘|修正と証拠|
|---|---|
|写真503後の除外でFile消失|PhotoEditorローカル保持を編集画面のitem ID別保持へ移動。修正前は再追加後のblobがdefault画像へ戻るテスト失敗を確認。修正後はPC/スマホで再生成を含め保持・再試行成功。|
|履歴なしのlogout失敗が無表示|noticeを渡しrole=alertで表示。修正前のalert不存在による失敗、修正後の503→表示→再試行成功を確認。|
|環境固有ユーザー名の資料記載|キャッシュ場所を%USERPROFILE%表記にし、資料・コードの同名残存を検索確認。|
|アクセント色の後続上書き|実際の後続CSSを濃色tokenへ統一。|
|再ログイン確認の名称不整合|検証スクリプトにlogout→新規login→同一冊子ID比較を実装して実行。ensure再送だけの確認から修正。|

レビューで判断を保留した範囲は、CSVの継続同期・削除反映、同梱vendor全体の製品コードとしての全面監査、Docker/実機/正式Cloudflare監査、美術品質の再評価。継続同期は今回仕様外とし、残りは既存のSHA検証・主担当の目視・未検証欄と区別して扱う。

修正差分を同担当が読み取り再確認し、5件すべてClose、新たな重大指摘なし、Readyと判定した。実行結果は主担当が上記コマンドで確認しており、ソースレビュー担当が独立にテストを再実行したとは主張しない。

## 空DBからの取込再現

既存DBは削除せず `kondo_final_verify_20261109` を新規作成。Node26のPATHを有効にし、以下を実行した。

```powershell
$env:DATABASE_URL = 'postgres://postgres@127.0.0.1:55432/kondo_final_verify_20261109'
npm run db:migrate
npm run db:seed
npm run data:inspect -- C:\AI-Sprint\sample-data
npm run data:import -- C:\AI-Sprint\sample-data --with-demo-aliases
npm run data:import -- C:\AI-Sprint\sample-data --with-demo-aliases
$env:PORT = '3003'
$env:UPLOAD_DIR = '.local/final-verify-uploads'
npm start
# 別ターミナルで同じDATABASE_URLと、以下のURLを指定
$env:E2E_BASE_URL = 'http://127.0.0.1:3003'
npm run data:verify
npm run test:e2e
```

inspectは500利用者、287参加後回答、2,629スタンプ、584特典履歴、480人に実績・20人は履歴なし、7スポット、使用可能メール0件。初回は `imported`、同じ内容の再投入は `already_imported`。DBへは必要な500人・287回答・2,629訪問を保持し、特典や登録時属性は取り込まない。

data:verifyの結果は `verified:true, organizerUsers:500, organizerStampEvents:2629, aliasHistoryMatchesDatabase:true, emptyHistoryNotGenerated:true, reloginDoesNotDuplicate:true`。マスクメールを推測せず、明示的なデモ別名で動作を検証した。元CSVの補完や変更はない。

Windows PowerShell 5.1では、実行ポリシーによる停止と、UTF-8 BOMなし日本語の誤解釈を追試で確認した。READMEに子プロセス限定の実行指定を明記し、補助スクリプトをASCIIへ修正。修正版を専用の `.local/bootstrap-verify-final/scripts` へコピーして、別cluster・127.0.0.1:55433で初期化から通常停止まで成功した。既存clusterやWindowsの恒久ポリシーは変更していない。

## 画面証跡

[PC画面](verification/desktop-editor.png) / [スマホ画面](verification/mobile-editor.png) / [スマホログイン](verification/mobile-login.png) / [条件選択](verification/mobile-settings.png) / [PC再試行](verification/desktop-photo-retry.png) / [スマホ再試行](verification/mobile-photo-retry.png)

[カラフルPNG・PC](verification/export-colorful-desktop.png) / [ポストカードPNG・スマホ](verification/export-postcard-mobile.png)

長いPNGは端末幅に応じた縦長の書き出し。UIの全画面キャプチャと出力PNGは別資料で、後者には操作部品を含めない。元の承認案は `docs/design-mockups` に保存している。

## demo01追加の追試

`demo01@example.test`（表示名demo01、コード1111）をfixtureへ追加。テスト追加直後は未登録404で失敗することを確認し、seed修正後に訪問2件・冊子0件から初回自動生成を確認した。PC/スマホとも再ログインで同一冊子ID・revisionを維持し、全10 E2Eが合格した。型チェック・build・46単体/DB統合・npm audit 0件・スキルinventoryも再実行した。

専用検証DBでseed再実行前後のdemo01冊子が同一であることを確認。通常デモDBにも追加し、認証成功・訪問2件・冊子未作成をAPIで確認後にログアウトした。通常デモ側ではensureを呼ばず、利用者が初回作成から試せる状態を残した。fixture全体は4人・6訪問で、主催者CSVの履歴とは分離している。

## 体験カテゴリ紙面の反映確認

2026-11-09、`codex/category-pickup-layout` で「みる・あそぶ・たべる・いやす・かう」の固定5カテゴリ、写真ヒーロー、モデルプラン、下段補足ブロックの実装を反映した。

- Node 26.13.0で `npm run build` 成功。server TypeScriptとVite SPAを生成した。
- 通常デモDB `kondo_anatato` に `db:migrate` と冪等の `db:seed` を適用。`pickup_category` とレビュー済みの「買い物」タグを反映し、既存冊子と編集値はリセットしていない。
- 3001番の対象サーバーだけをHiddenで再起動。`GET /api/health` と `GET /` は200。写真保存先は既存の非公開 `UPLOAD_DIR` を維持した。
- 実ブラウザーのPC幅でヒーロー、5カテゴリ全件、下段のモデルプラン・思い出・招待文の3列を目視。各カテゴリは灯台・音楽堂・夜市・水鏡湖・石畳通りの重複なし。
- 390×844で、カテゴリカードの横スワイプ用部分表示、ヒーロー、固定共有バーを目視。DOMで5件とモバイル共有バーの表示も確認した。
- AGENTS.mdの明示依頼限定ルールに従い、今回の差分に対する `npm run check` / `npm test` / `npm run test:e2e` / `npm audit` / skill inventoryと独立レビューは実施していない。保存・再ログイン・PNGの新紙面専用再検証も未実施。

## pnpm移行の検証範囲

2026-11-09、依存管理をnpmからpnpmへ移行した。移行前のnpm lockfileに記録されていた直接依存25件の解決版を `package.json` へ正確に固定し、pnpm 11.25.0で `pnpm-lock.yaml` へ変換した。互換範囲と `latest` タグは使用していない。

- Node 26.13.0からpnpm 11.25.0を起動し、`pnpm install --lockfile-only --offline --frozen-lockfile --ignore-scripts` 相当が終了コード0。実行前後のlockfile SHA-256は `704F01F3BF9E01413969B3F4E67468FD5634B5A879F7F0CA1282206552128EDE` で不変。
- Node 26.13.0／pnpm 11.25.0で `pnpm run build` 相当が終了コード0。server TypeScriptとVite 8.3.6のSPA（1,583 modules）を生成し、実行前後でlockfileは不変。
- 最終build後、3001番の対象プロセスをこのworkspaceのNode 26.13.0と `dist/node/server/index.js` であることまで再同定し、そのPIDだけを停止。プロジェクト同梱Node 26.13.0から `--env-file-if-exists=.env dist/node/server/index.js` をHiddenで再起動した。PostgreSQLと別アプリは停止せず、`GET /` と `GET /api/health` は200。
- AGENTS.mdの明示依頼限定ルールに従い、この移行差分に対する `pnpm run check` / `pnpm test` / `pnpm run test:e2e` / `pnpm audit` / data verification / skill inventoryと独立レビューは実施していない。

## 町側管理画面の反映（2026-11-09）

- `003_town_admin.sql` を通常デモDB `kondo_anatato`（127.0.0.1:55432）へ適用。既存データの初期化やfixture再投入は行わず、町デモ `town@example.test` を追加した。
- Node 26.13.0 / pnpm 11.25.0で `build` 成功。server TypeScriptとVite SPAを生成した。デスクトップ付属pnpmラッパーは別Node 24と自動installへ進んだため失敗し、Node 26からpnpm.mjsを直接起動、`--config.verify-deps-before-run=false` で既存依存によるbuildを実行した。依存スクリプトの実行許可設定は変更していない。
- 3001番PIDとプロジェクト内Nodeパス・サーバーentrypointを同定し、このアプリのみHidden再起動。PostgreSQLと別アプリは停止していない。
- 最小HTTP参照で `GET /` は200、新しいビルドのJS参照を確認。`GET /api/health` は200 / `{"ok":true}`。
- AGENTS.mdに従い、町側ログイン・権限境界・CRUD・集計・写真再試行・既存利用者フローのテスト、check、audit、E2E、独立レビュー、画面目視は未実施。buildとHTTP配信確認を機能テストの合格とは扱わない。共有状況の実装は保留。

## 明示依頼による現在版の再検証（2026-11-09）

ユーザーの「今の時点で検証を実行して」により実施。検証中に別作業から製品コード・テストの更新が入ったため、初回結果と更新後の結果を区別する。`fd96b61` に未コミット差分を含む54ファイルを `.local/verify_20261109_1794202347818/snapshot` へコピーし、2026-11-09 14:38:43 JST時点のSHA-256一覧を同ディレクトリの親の `snapshot-manifest.json` に記録した。さらにカテゴリ整理と町側テストの更新を取り込んだ55ファイルを14:43:50 JSTに `final-snapshot` へ固定し、`final-snapshot-manifest.json` を記録した。後続の変更はスマホPNG用CSSと追加E2Eの2ファイルだけで、14:47:08 JSTの `png-snapshot` / `png-snapshot-manifest.json` で追試した。追試後、対象55ファイルは作業元とSHA-256が一致した。元の修正作業は停止していない。

|確認|今回の実行結果|
|---|---|
|環境|同梱Node 26.13.0 / 固定pnpm 11.25.0 / PostgreSQL 17.11 / Microsoft Edge。pnpmのモジュールをNode 26から直接起動し、`--config.verify-deps-before-run=false` で検証中の自動installを抑止。|
|型・ビルド|更新後コピーで `pnpm run check` / `pnpm run build` 相当が終了コード0。|
|単体・API統合|専用DBを `TEST_DATABASE_URL` に指定し、最終コピーの `pnpm test` 相当が5ファイル・57件合格、skipなし。中間コピーは55件、初回の更新前実行は47件合格。|
|ブラウザE2E|最終コピーで既存14件すべて合格、2.1分。後続のPNG用CSS差分を別コピーでbuildし、追加PNGレイアウトテストをPC/スマホ各1件、計2件実行して合格。16件を単一コマンドで一括実行した結果ではない。|
|依存監査|更新後コピーで `pnpm audit` 相当が終了コード0、既知の指摘0件。|
|スキル整合性|`node scripts/skill-inventory.mjs` が終了コード0。292ファイル・24スキルの一覧とSHA-256が一致。|
|CSV取込|別の空DBでmigration、inspect、import、再importを実行。500人・2,629履歴・287参加後回答、480人に履歴・20人は履歴なし。初回 `imported`、再投入 `already_imported`。元CSVは読み取りのみ。|
|取込API確認|専用DB・専用写真保存先・3004番の検証アプリで `data:verify` が終了コード0。`verified:true`、件数一致、履歴なし生成拒否、再ログイン重複なし。更新後コピーの同スクリプトからも再確認。|
|現画面の補足確認|専用環境と架空fixtureでPC/スマホの5カテゴリ、コメント保存503後の再試行と再読込、写真503後の再試行、テンプレート、HTMLプレビュー、2種のPNGダウンロードを確認。ページ全体の横はみ出しと外部HTTP要求はなし。|
|町側の補足確認|未認証・一般利用者・提供データ利用者の管理API拒否、町アカウントの利用者API拒否、500/480の集計、履歴なし20件、登録一覧の返却フィールド、スポット作成・更新・revision競合・画像保存・非認証画像拒否・公開停止を確認。PC/スマホの概況・スポット一覧も目視。正式な包括的セキュリティ監査ではない。|

利用中の3001番アプリ・DB・ユーザー写真はテスト対象にせず、テスト用DBと写真保存先を分離した。最後に今回起動した3003/3004/3005番の検証アプリだけを同定して停止し、既存3001番のhealthがHTTP200であることを確認した。DBと検証用ファイルは削除していない。今回作成した検証プログラムとtraceは `.local/verify_20261109_1794202347818` に保持し、Gitには含めない。永続テストや製品コードの更新は並行作業の差分であり、本検証作業では編集していない。

### E2Eの実行経路と更新前の失敗

初回の `pnpm run test:e2e` 相当は、旧npm配置のCLIとpnpm配置のテストモジュールが別々にロードされ、テスト収集前に失敗した。同じ配置の `node node_modules/@playwright/test/cli.js test` で実行すると10件中5件合格・5件失敗。4件は旧 `route-item` / `新しい候補` を探しており、残る1件は再ログイン時のカテゴリ整理による未保存確認後にログアウトできず失敗した。

14:38の中間コピーでは町側を含む14件中10件合格・4件失敗。町側の登録状態selector待機がPC/スマホの2件、スマホの町側競合回復で入力が保持されない期待違反、スマホの再ログイン後のログアウト待機の計4件。後続の変更を取り込んだ最終コピーで全14件を再実行し、14件すべて合格した。traceとエラーの詳細は作業用ディレクトリ内の `latest-e2e-results` / `final-e2e-results` に保存する。

READMEに残っていた `pnpm run data:inspect -- ...` の区切りはpnpm 11でスクリプト引数へそのまま渡され、CLIの引数検証に失敗した。区切りを外すとinspect/importが成功したため、READMEの実行例を修正した。DBテスト例の接続先も利用中DBから専用テストDB名へ変更した。

### PNGの目視で検出した問題と修正後の追試

**修正前は不合格、修正後の追試は合格。** 修正前はカラフル・ポストカードの両方で、横スワイプするカテゴリカードが画像の右で欠け、5カテゴリすべてが収まらなかった。下段のモデルプラン・思い出・招待文も狭い3列へ圧縮され、極端に折り返した。ダウンロード成功と編集UI除外だけでは共有用画像の品質を判定できない問題だった。

出力用 `.png-mode .category-grid` は列指定を持つが、後続のスマホ用 `.category-grid { display:flex }` とカードのflex幅が残っていた。一方、出力用 `.brochure-support-grid` は狭い幅でも3列を強制していた。並行作業で820px以下のPNGモードを縦1列へ切り替えるCSSと追加E2Eが入り、その差分だけを別コピーへ取り込んでbuildした。

追加E2EはPC/スマホとも合格。さらに修正後アプリからスマホの両テンプレートを実ダウンロードし、全5カテゴリと補足3ブロックが縦に収まり、写真・コメントが反映され、編集UIが除外されることを目視した。実出力は作業用ディレクトリの `fixed-mobile-colorful.png` / `fixed-mobile-postcard.png`。修正は本検証作業ではなく並行作業の差分。

証跡: [修正後スマホ・カラフル](verification/2026-11-09-current/mobile-colorful-fixed.png) / [修正前スマホ・カラフル](verification/2026-11-09-current/mobile-colorful.png) / [修正前スマホ・ポストカード](verification/2026-11-09-current/mobile-postcard.png) / [PC・カラフル](verification/2026-11-09-current/desktop-colorful.png)。画像内のコメント・写真は検証fixtureのみ。提供CSVの実値・ユーザー写真は含めない。

## 町側テスト・レビュー後の修正確認（2026-11-09）

上記の並行検証snapshotより後に、写真の競合回復・登録再送の冪等化・カテゴリ保存/復元・スマホPNGを修正した。最終実行は単体/実DB統合57件（skipなし）、PC8件/スマホ8件のE2E計16件が合格。check/build、pnpm audit指摘0、登録済みskill inventory一致、別の空DBへのCSV取込・冪等再投入・data:verifyも成功した。**上記snapshotで不合格だったスマホPNGは本改修後に解消を確認した。**

独立ソースレビューのImportant1件・Minor1件は回帰テストで修正を確認。3001番は対象アプリだけをHidden再起動し、トップとDB疎通の200・新しいビルド配信を確認した。利用中DB/写真をテストに使わず、専用3077/3078番の検証アプリは終了後に停止した。共有状況は保留。

根拠・発見内容・未実施範囲は[町側管理機能の最終検証記録](town-admin-verification.md)を参照。

## スポット詳細・プレゼント受取の反映（2026-11-09）

着手前の現状を `fdef044` へコミットした後、スポット詳細、管理用プレゼント設定・ラベル、利用者の受取確認と一度限りの記録、町側の受取件数・匿名履歴を追加した。最新のユーザー訂正に従いQRは実装せず、確認ダイアログの「OK」だけで記録する。既存のスタンプ履歴と共有状況の範囲は変更しない。

- Node 26.13.0 / pnpm 11.25.0で `pnpm run build` 相当が終了コード0。server TypeScriptとVite SPA（1,585 modules）を生成した。追加依存はない。
- 通常デモDB `kondo_anatato`（127.0.0.1:55432）へ `pnpm run db:migrate` 相当が終了コード0。`004_spot_gift_claims.sql` の初期設定は全スポット提供オフ・新規受取記録なし。既存冊子・写真・コメントのリセットやCSV再投入は行っていない。
- 3001番PID 21912をこのプロジェクトのNode実体とserver entrypointで同定し、そのアプリだけを停止。`--env-file-if-exists=.env dist/node/server/index.js` をHiddenで起動（PID 14400）。PostgreSQLや別アプリは停止していない。
- 最小HTTP参照は `GET /` が200、配信JSは `/assets/index-C6A3z194.js`。`GET /api/health` は200 / `{"ok":true}`。
- AGENTS.mdの明示依頼限定ルールに従い、この追加差分のcheck、単体/API統合、E2E、audit、skill inventory、画面目視・操作テスト、独立レビューは未実施。直前の57件/16件の合格を本機能へ流用しない。受取の権限境界・並列要求・再送・設定変更との競合、モーダル操作・プレビュー・PNGは今後の検証対象。

## クーポン表記・6桁コード表示への変更（2026-11-09）

ユーザーのブラウザ注釈に従い、利用者画面と町側設定・履歴の表記をクーポンへ統一した。「クーポンを表示する」で英数字6桁のコードを発行・表示し、確認画面「クーポンをつかう」の「使う」だけで既存の一度限りの履歴を記録する。表示・キャンセルは利用件数へ含めない。既存の提供設定・使用済み記録を維持し、新表へ未使用コードを保存する。

- Node 26.13.0 / pnpm 11.25.0の `build` が終了コード0。server TypeScriptとVite SPA（1,585 modules）を生成。追加依存なし。
- 通常デモDB `kondo_anatato`（127.0.0.1:55432）への `db:migrate` が終了コード0。追加は `005_spot_coupon_codes.sql`。CSV再投入・データ初期化・利用操作は行っていない。
- 3001番PID 14400のNode実体・server entrypoint・待受ポートを同定して、そのPIDのみ停止。既存のenv-fileを使用してHidden起動（PID 29968）。PostgreSQLや別アプリは停止していない。
- 最小HTTP参照は `GET /` が200、配信JSは `/assets/index-Dxgwv2Rm.js`。`GET /api/health` は200 / `{"ok":true}`。
- AGENTS.mdに従い、この変更のcheck、単体/API統合、E2E、audit、skill inventory、画面目視・操作テスト、独立レビューは未実施。コードの再表示・同時発行・重複再生成、使用済み保持、表示と利用の計測分離、モーダル操作は未検証。前回の57件/16件の合格範囲へ含めない。

## 共有URL・表示回数・作成者限定クーポンの反映（2026-11-09）

共有保留を解除するユーザー指示に従い、保存済み冊子の共有URL、プレビューのURLコピー/公開停止/件数、町側の匿名共有状況を追加した。共有本文は掲載/選択した思い出の範囲に絞り、写真は共有トークンと対象itemを照合するAPIで配信する。未ログイン・別利用者・町アカウントへクーポン情報を返さず、作成者のログイン時だけラベル・利用操作を表示する実装。APIの役割・所有者境界を維持する。

- Node 26.13.0 / pnpm 11.25.0の `build` が終了コード0。server TypeScriptとVite SPA（1,589 modules）を生成。追加依存なし。
- 通常デモDB `kondo_anatato`（127.0.0.1:55432）へ `db:migrate` が終了コード0。追加は `006_brochure_shares.sql` の共有設定・表示記録表。既存冊子/写真/クーポン履歴のリセットやCSV再投入は行っていない。利用中の冊子のURL発行・公開・閲覧計測は確認目的で行っていない。
- 3001番PID 29968のNode実体・server entrypoint・待受ポートを同定し、そのPIDのみ停止。初回のHidden起動後、思い出の最新日時/スタンプ表示を追加して再buildし、対象PID 25164だけを同じ条件で同定・停止して最終Hidden起動（PID 25816）。既存env-fileを使用し、PostgreSQLや別アプリは停止していない。
- 最終ビルドの最小HTTP参照は `GET /` が200、配信JSは `/assets/index-CrWQU1dY.js`。`GET /api/health` は200 / `{"ok":true}`。
- AGENTS.mdに従い、この追加差分のcheck、単体/API統合、E2E、audit、skill inventory、画面目視・操作テスト、独立レビューは未実施。共有URLの所有者分離、非所有者のクーポン非表示、共有写真境界、表示UUIDの再送/並列計測、公開停止、未保存時のコピー制御、既存紙面/PNGの再検証は今後の対象。過去の57件/16件や監査結果を本機能の合格へ流用しない。

URLは現在のローカルアプリ向け。インターネット/LAN公開は追加せず、表示回数は再読み込みを含むブラウザからの申告記録で、人数や現地来訪を保証しない。

## 英語補助見出しの削除（2026-11-09）

ブラウザ注釈の「NEXT TRIP」「MODEL PLAN」「LAST TRIP」を共通紙面から削除し、日本語見出しを保持した。Node 26.13.0 / pnpm 11.25.0でbuildが終了コード0。3001番の対象PID 25816をNode実体・entrypoint・ポートで同定し、そのPIDだけを停止してHidden起動（PID 11676）。`GET /` と `/api/health` は200、新JSは `/assets/index-jXhiE7oi.js`。DB変更なし。AGENTS.mdに従い追加テスト・画面目視・レビューは未実施。

## 思い出から次の旅をつくる文言・選択UI（2026-11-09）

ユーザーの先行6注釈・作成中見出しの回答・追加4注釈をまとめて反映。ログイン説明、初回の訪問スポット未選択、特徴の短文、選択案内強調、「どんな旅にしたい」「この内容で次の旅をつくる」、指定の作成中見出し、同行者別の情緒あるタイトル、由来のヘッダー、カード区分「前回の思い出」「新しい体験」を追加した。条件変更時はisMemoryを復元する。従来の自動生成タイトルに完全一致する保存値だけをGET応答で新表現へ変換し、独自タイトル・写真・コメント・共有URL・クーポン履歴を一括変更しない。

- Node 26.13.0 / pnpm 11.25.0のbuildが終了コード0。server TypeScriptとVite SPA（1,589 modules）を生成。追加依存・DB schema変更・データ再投入なし。
- 3001番のPID 11676をNode実体・server entrypoint・待受ポートで同定し、そのPIDだけを停止して既存env-fileでHidden起動（PID 32812）。DBと別アプリは停止していない。
- 最小HTTP参照は `GET /` が200、配信JSは `/assets/index-BeXDbb6l.js`。`GET /api/health` は200 / `{"ok":true}`。
- AGENTS.mdに従い追加のcheck、単体/API統合、E2E、audit、skill inventory、画面/PNG目視、独立レビューは未実施。初回0件からの選択・0件送信拒否・既存思い出復元・全同行者のタイトル・独自タイトル保持・狭幅/長文・共有/PNGは今後の検証対象。過去の57件/16件を本差分の合格としない。

## しおり画面の整理・相手別招待（2026-11-09）

最新10件のUI注釈に従い、カードに場所の概要と推薦理由を分けて表示し、招待文欄・テキストコピー・PNG保存の操作をPC/スマホから削除した。入口は「しおりを見る」、閲覧見出しは「旅のしおり」、順路は「おすすめの訪問順」。共有説明2段落と常設URL欄を削除し、相手別の「{同行者}を誘う」（一人は「しおりを共有する」）へ変更した。Clipboard失敗時だけブラウザのコピー用ダイアログを使う。訪問順のクーポンはプレゼントアイコン＋文字で右寄せ。共有API・表示計測・クーポン認可と保存済みデータは変更しない。

- Node 26.13.0 / pnpm 11.25.0でbuildが終了コード0。server TypeScriptとVite SPA（1,580 modules）を生成。不要になった招待文コピー/PNG画面処理とクライアントの画像出力importを除去した。追加依存・DB schema変更・データ再投入なし。
- 3001番のPID 32812をNode実体・server entrypoint・待受ポートで同定し、そのPIDのみ停止。既存env-fileでHidden起動（PID 34380）。DBと別アプリは停止していない。
- 最小HTTP参照は `GET /` が200、配信JSは `/assets/index-DO9kJDg1.js`。`GET /api/health` は200 / `{"ok":true}`。
- AGENTS.mdに従い追加のcheck、単体/API統合、E2E、audit、skill inventory、画面目視、独立レビューは未実施。相手別招待・公開停止後の再開・Clipboard失敗・未保存時の制御、概要/推薦理由の長文・コメント保持、2操作バー・クーポン右寄せ・共有の所有者分離は今後の対象。旧招待文コピー/PNG保存を前提にする既存E2Eは今回更新・実行していない。過去の57件/16件を本差分の合格へ流用しない。

## 追加デモスポット10件（2026-11-09）

- 登録前に追加分だけのCSV `data/additions/2026-11-09-additional-demo-spots.csv` を作成。バッチ・追加デモ表記・fixture出所・外部ID・画像注記で元データと区別した。
- Node 26.13.0 / pnpm 11.25.0でbuildが終了コード0。server TypeScriptとVite SPA（1,580 modules）を生成。追加依存・DB schema・API契約・生成規則の変更なし。
- `data:import-additions` の実行結果は `inserted=10`、`skipped=0`、`totalSpots=17`。登録処理が出力した公開中候補数は、みる7・あそぶ13・たべる4・いやす7・かう6。カテゴリ間で重複する候補を含み、利用者の履歴による絞り込み前の件数。既存外部IDへの再投入はコード上DO NOTHINGとしたが、再投入の動作検証は未実施。
- 3001番のPID 34380をこのworkspaceのNode実体・server entrypoint・待受ポートで同定し、このPIDだけを停止。既存env-fileでHidden起動（PID 24740）。DBと別アプリは停止していない。
- 最小HTTP参照は `GET /` が200、配信JSは `/assets/index-DO9kJDg1.js`。`GET /api/health` は200 / `{"ok":true}`。
- AGENTS.mdに従い追加のcheck、単体/API統合、E2E、audit、skill inventory、画面目視、独立レビューは未実施。追加スポットの初回生成・再生成・保存復元、同行者別の選出、再投入・競合・不正CSV時のrollbackは未検証。過去の合格範囲へ本差分を含めない。

## 町管理MCP・分析連携（2026-11-09）

- 公式MCP SDK 1.32.2を固定依存へ追加し、町管理者の接続キー管理・6分析ツール・指標resource・分析promptと管理画面を追加した。ChatGPTはデスクトップのローカルStreamable HTTP / Bearer接続向け。Web版のトンネル・外部公開・OAuth認証は追加していない。
- Node.js 26.13.0を明示してpnpm 11.25.0のエントリを起動し、`pnpm run build`相当を実行。server TypeScriptとVite SPAは終了コード0、1,583 modules。配信ファイルは`index-BidVunTr.js` / `index-4YQsl2cw.css`。buildはclientの独立した型チェックを含まない。
- 同じNode 26のビルド済みDB CLIでmigrationを実行し、終了コード0。007の`admin_mcp_keys`表を追加。元CSVや利用者の保存内容を変更していない。
- 3001番のPID 24740をworkspace内のNode実体・ビルド済みserver entrypointで同定し、このPIDだけを停止。プロジェクトルート・既存env-fileからHiddenで再起動、PID 15172。DBや別アプリは停止していない。
- 必要最小限のHTTP参照で `GET /api/health` は200 / `{"ok":true}`、`GET /` は200で本プロジェクトの画面を配信。待受は127.0.0.1:3001。
- AGENTS.mdのルールに従い、追加のcheck、単体/API統合、E2E、audit、skill inventory、画面目視、独立レビューは未実施。キー発行・失効・権限境界、日付境界、集計SQLの実データ結果、MCPプロトコルの実接続、ChatGPTでの分析結果は未検証。過去の合格範囲へ今回の差分を含めない。
- 既存のテスト・監査文書、並行して変更された利用者画面・共有編集用ファイルは本コミットへ含めない。ビルド時のワークスペースにはその並行変更も存在した。

## 追加スポット専用画像への変更（2026-11-09）

- 内蔵imagegenで追加10件の専用イラストを1点ずつ生成し、画像自体の主役・色合い・構図を確認した。料理・パフェ・パン・陶器・遊具・カヤック・足湯・展示・土産・テントなどで区別し、大きな青背景の使い回しを解消した。最終プロンプトとファイル対応は `docs/spot-image-prompts.md`。Sharpで960×640 / quality 86のWebPへ変換し、`public/assets/*-v1.webp` 10点（合計2,060,102 bytes）を同梱した。
- 追加CSVの画像参照・注記と町側の同梱画像選択肢を更新。既存7画像・本人写真は変更していない。`data:refresh-addition-images` は旧初期画像・fixture出所・revision=1・スポットアップロードなしの行だけを更新する。
- Node 26.13.0 / pnpm 11.25.0でbuildが終了コード0。server TypeScriptとVite SPA（1,587 modules）を生成。追加依存・DB schema・API契約・生成規則の変更なし。
- 画像移行コマンドの実行結果は `imagesUpdated=10`、`inserted=0`、`skipped=0`、`totalSpots=17`。既存スポットの画像参照だけを更新し、名称・タグ・利用者の履歴・冊子・コメント・本人写真へ更新SQLを発行していない。
- 3001番のPID 32464をworkspace内Node実体・env-file付きserver entrypoint・待受で同定し、このアプリだけHiddenで1回再起動（PID 20736、作業場所はプロジェクトルート）。プロセス内の公開キャッシュも新しくなった。DB・別アプリは停止していない。
- 最小HTTP参照は `GET /` と `GET /api/health` が200、healthのok=true、新JSは `/assets/index-D7KfAqJt.js`。新画像1件のHEADが200 / image/webp。ログイン・共有URLの閲覧・表示計測は行っていない。
- AGENTS.mdに従い追加のcheck、単体/API統合、E2E、audit、skill inventory、アプリ画面目視・操作テスト、独立レビューは未実施。小画面・管理画像変更・移行再実行/編集済み行のスキップ・共有内容の表示は未検証。生成画像の確認やbuildを、アプリ操作テストの合格とは扱わない。

## 未検証・残存事項

### ピックアップ変更一覧の説明文（2026-11-09）

- ユーザーの添付画面に合わせ、候補リストに説明の最初の1文を表示。Unicode40文字を超える場合は「...」で省略する。モバイルの説明非表示指定を解除し、テキストを枠内で折り返す。説明原文・DB・APIの変更なし。
- Node 26.13.0・固定pnpm 11.25.0のbuildが終了コード0、1,587 modules。JS `index-DuBbRS-C.js`、CSS `index-CMr4w9dt.css`。3001番のPID 20736をNode実体・entrypoint・待受で同定し、そのアプリだけHidden再起動（PID 24196）。最小HTTP参照の `/` と `/api/health` は200、新しいJSの配信を確認。DB・別アプリは停止していない。
- 検証保留を継続し、追加のcheck・単体/API・E2E・audit・skill inventory・画面操作・目視・独立レビューは未実施。過去の合格を本差分に適用しない。後続のコミット依頼に従い対象変更をコミットし、別作業の監査レポートは含めない。

### 公開URLコピー回数・アクセス数の反映（2026-11-09）

- 管理の共有状況、作成詳細、スポット詳細分析にコピー回数とアクセス数を追加。コピー成功後の共有ID＋操作UUIDを作成者専用APIへ送り、再送を除外する実装。スポット分析は累計と期間内の日別コピー・アクセスを表示する。
- Node 26.13.0・固定pnpm 11.25.0でbuildが終了コード0。server TypeScriptとVite SPA、1,587 modules。JS `index-COn-T9Xn.js`、CSS `index-CKsPSOva.css`。clientの独立した型チェックは未実施。
- 同じNodeのビルド済みDB CLIで通常DBへ008 migrationを適用し終了コード0。既存のコピー数は0から計測し、過去コピーを推測しない。既存のアクセス数・公開状態・URL・冊子・写真のリセットやCSV再投入は行っていない。
- 3001番のPID 24620をNode実体・env-file付きserver entrypoint・待受で同定し、そのアプリだけHidden再起動（PID 32464）。DB・別アプリは停止していない。必要最小限の `/` と `/api/health` は200、新JS配信を確認。
- ユーザーの検証保留を継続し、check、単体/API、E2E、audit、skill inventory、画面操作・目視・独立レビューは未実施。既存テストの返却キー／見出し期待値だけは新契約へ合わせたが実行していない。コピー成功／失敗、再送、所有者切替、日別集計の実データ突合を機能合格とはしていない。過去の71件／20件を本差分へ適用しない。
- コピー記録に通信が必要で、2回の失敗後は同じ画面で再送できる。閉じた画面の未送信記録は復元しない。手動コピーを含まず、実コピーの独立した証明でもない。スポットの数値は現在掲載するしおりの合計で、個別スポット閲覧数ではない。
- 反映時点では前回の管理詳細追加と合わせて作業ツリーに保持。後続のコミット依頼に従い対象差分をコミットする。別作業の監査レポートは含めない。

### 町側の作成詳細・スポット別分析の追加（2026-11-09）

- 登録一覧に匿名利用者の作成詳細、スポット管理にスポット別の詳細分析を追加。作成条件・掲載／思い出・編集有無・共有状況、累計と条件内訳、JSTの期間指定グラフ／日別表、掲載しおりからの作成詳細を表示する実装。型と契約は `src/shared/admin-detail-types.ts` / `docs/database.md` に記載。
- Node 26.13.0・固定pnpm 11.25.0の `build` が終了コード0。server TypeScriptとVite SPA、1,587 modules。JS `index-CZTRIF6z.js`、CSS `index-BJp2BFgK.css`。独立したclientの型チェックは行っていない。
- 3001番の待受・workspace内Node実体・env-file付きserver entrypointを再同定。並行作業の再起動でPIDが変わったため古いPIDへの停止はガードで中止し、最新の対象PID 35716だけを停止してHidden起動（PID 24620）。DBや別アプリは停止していない。
- 必要最小限のHTTP参照で `/` と `/api/health` は200、新しいJSの配信を確認。今回のDB migration・CSV再投入・データリセットは不要で、行っていない。
- ユーザーの「時間のかかる検証はいったん保留」に従い追加のcheck、単体/API統合、E2E、audit、skill inventory、追加画面の目視・操作・独立レビューは未実施。SQL集計の実データ突合、API境界、日付境界、戻る際のフォーム保持、PC/スマホ表示も機能合格とはしていない。過去の71件／20件の成功はこの追加差分に適用しない。
- 反映時点では追加差分を作業ツリーに保持。後続のコミット依頼に従い作成詳細・スポット分析・公開URL計測をまとめてコミットする。別作業の監査レポートや画像変更の計画は含めない。

### 公開キャッシュの有効期間を1日に変更（2026-11-09）

- 明示指示により公開応答キャッシュの既定期限を30秒から1日（24時間）へ変更。32MiB/128件/1件4MiBの容量制限、状態変更APIのJSON応答時・切断時のクリア、表示回数POSTの除外を維持する。CLI/DB直接更新の即時反映にはアプリ再起動が必要で、再起動しない場合は最大1日かかる。
- Node 26.13.0 / pnpm 11.25.0でbuildは終了コード0、Viteは1,587 modules。並行作業の管理画面変更を含むワークスペースでのビルドであり、今回のコミットにはキャッシュ期限と関連資料の変更だけを含める。
- 3001番のPID 28036をこのworkspaceのNode実体とserver entrypointで同定し、そのアプリだけ停止。既存env-file/作業場所からHidden PID 35716で再起動した。DBや別アプリは停止していない。
- 最小HTTP参照でトップと`/api/health`は200、healthは`{"ok":true}`。配信JSは`index-CZTRIF6z.js`。追加テスト・check・audit・E2E・独立レビュー・キャッシュの動作/負荷測定は未実施。

### 公開コンテンツのキャッシュ追加（2026-11-09）

- 非所有者向け共有本文と認可済み共有写真の応答バイトだけに、30秒・合計32MiB・128件・1件4MiBのサーバーメモリー内キャッシュを追加。作者本文と認証/編集/管理応答は格納しない。公開状態・本人判定・写真の掲載範囲は毎回DBで確認し、HTTPの`no-store`は維持する。
- 状態変更APIのJSON応答と切断時に破棄し、表示回数のPOSTは対象外。失効前の読込が後から完了しても再格納しない。単一プロセス向けで、CLI/DB直接更新の反映は最大30秒。既に進行中の取得は更新前の内容を返す場合がある。
- Node 26.13.0 / pnpm 11.25.0で`pnpm run build`を実行し終了コード0。server TypeScriptとVite SPA（1,584 modules）を生成。これはクライアントとテストの独立した型チェックを含まない。ビルド時点のワークスペースには、別作業の管理詳細画面/サーバーの並行変更も存在した。
- 3001番のPID 33312をこのworkspace内のNode実体と既知のserver entrypointで同定して停止し、同じ既存env-fileと作業場所からHiddenで再起動。待受は127.0.0.1:3001、反映後PID 28036。DBと別アプリは停止していない。
- 最小HTTP参照で`GET /api/health`は200 / `{"ok":true}`、`GET /`は200。配信JSは`index-9q8yLLoc.js`。トップ確認用変数の予約名衝突を修正してトップの結果を再取得した。利用者のログイン・URL発行・保存操作は行っていない。
- 期限/LRU/容量/巨大値/同時読込/失敗再試行/失効競合の単体8ケースと、共有APIの所有者表示分離・保存/管理更新反映・写真削除/公開停止/再開の回帰ケースを記述した。AGENTS.mdに従い、追加のcheck・単体/API統合・E2E・audit・skill inventory・負荷試験・独立レビューは未実施。実際のキャッシュ再利用・失効・負荷軽減は動作検証しておらず、過去のテスト結果を本差分の合格へ流用しない。

- 実機iPhone/Android、Safari、スクリーンリーダー、200%ブラウザズーム、実機のソフトキーボードとの共存は未検証。WCAG完全適合とは主張しない。
- Docker構成は未実行。検証済みのPostgreSQL経路はWindows公式バイナリによるローカル起動。
- Cloudflare Security Auditの正式6段階完全監査は **incomplete / missing_os_enforced_sandbox**。通常テストとソースレビューは実施済みだが、OS隔離・資源強制制限を備えた監査ではない。[適用記録](security-skill-review.md)を参照。
- 固定認証コードは本人確認にならず、ローカルHTTP専用。LAN/クラウドへ公開しない。メール存在案内、inline style、写真削除失敗時の孤児ファイル、高負荷競合の検証不足は [セキュリティ資料](security.md) に記載。
- 未保存入力・失敗写真の一時保持はブラウザ終了で失われる。ブラウザ内への永続ドラフト保存は実装していない。
- Python標準helperの補助キャッシュ1件がプロジェクト外に残る。削除はポリシーで拒否され、再削除していない。[場所と影響](skills.md)を記録した。

### 公開しおりのキャッシュHIT時のDB照合を省略（2026-11-10）

- ユーザー指示により、公開本文・共有写真の公開状態/掲載範囲の照合をMISS内へ移した。匿名HITはDB問い合わせと接続取得を行わない。本文の内部所有者IDはレスポンスへ追加せず、ログイン済みのセッション検証と作者向けクーポンの生成を維持する。共有写真のキーは公開トークン・写真種別・写真IDを分離する。
- `X-Public-Cache: HIT / MISS / COALESCED / BYPASS`を追加。TTL24時間・32MiB・128件・1件4MiB、同時読込の集約、保存・掲載解除・写真変更・公開停止時の失効、失効前の読込を再格納しない処理は維持する。DB直接更新・別プロセスによる公開停止も、即時反映にはアプリのキャッシュクリアが必要となる。
- 利用中DBと分けた専用PostgreSQL DB、一時画像保存先でAPI統合・キャッシュ単体38ケースが成功（skip 0）。匿名本文と共有写真のHITで`pool.query`・`pool.connect`とも0回、作者/非作者の情報分離、写真種別のキー分離、保存/管理更新・写真削除・公開停止/再開後の失効を確認した。変更前には匿名HITのSQL禁止テストが失敗したことを確認している。
- Node 26.13.0・pnpm 11.25.0でcheck/buildが終了コード0。pnpm auditは既知脆弱性なし、skill inventoryは297ファイル・27スキルで一致。独立レビュー、全画面E2E、CSV再取り込み、長時間負荷試験は未実施。
- 3001番アプリの停止・Hidden再起動コマンドは自動承認レビューで`blocked by policy`として拒否され、実行されなかった。その後、稼働プロセスの切替を観測し、対象Node/entrypointのPID7392と、公開本文のMISS→HITを確認して反映済みプロセスを測定した。DBや別アプリを停止していない。
- 同じPC内、同じ約4,665バイトの匿名本文API、同時実行上限100。1,000→2,000→3,000→4,000→5,000req/s、各15秒、最大226,000要求・5分の条件で実施。p95 20ms・p99 100ms（または基準の3倍）、HTTP失敗、予定送信欠落で中止する設定とした。

|投入負荷|実測秒数|完了/成功要求|HIT / MISS|p95 / p99|予定送信欠落|
|---|---:|---:|---:|---:|---:|
|1,000req/s|15.00秒|15,000 / 15,000|15,000 / 0|1ms / 2ms|0|
|2,000req/s|5.98秒・中止|11,628 / 11,628|11,628 / 0|1ms / 3ms|321|

- 完了26,628要求は全件HIT・HTTP失敗0。2,000req/s段階では監視接続自身を除いたアプリDB接続は全8サンプルで0本、DBのロック/I/O待ちも0。前回のDB照合ありの2,000req/sではp99 15ms、今回3ms。ただし測定時間と背景負荷が異なるため改善倍率や最大容量の保証にはしない。
- 2,000req/sで予定送信が追随できず中止し、3,000〜5,000req/sは未実施。同サイズ4,665バイトの簡易応答を同じ同時実行100・2,000req/sで8秒測る対照試験は16,000要求成功・p99 2ms・欠落0だった。公開アプリ経路の一時遅延と生成側の実行待ちなどの内訳は未特定で、サーバー自体の最大能力を2,000req/sと断定しない。
- 終了後のhealthと公開本文は200、本文はHIT、k6稼働プロセス0を確認した。再現用設定と詳細集計はGit管理外の`.local/performance/20261110T105750/`。本文・写真・完全な共有トークンを検証文書へ転記していない。
