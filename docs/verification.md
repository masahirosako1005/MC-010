# 最終検証記録

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

## 未検証・残存事項

- 実機iPhone/Android、Safari、スクリーンリーダー、200%ブラウザズーム、実機のソフトキーボードとの共存は未検証。WCAG完全適合とは主張しない。
- Docker構成は未実行。検証済みのPostgreSQL経路はWindows公式バイナリによるローカル起動。
- Cloudflare Security Auditの正式6段階完全監査は **incomplete / missing_os_enforced_sandbox**。通常テストとソースレビューは実施済みだが、OS隔離・資源強制制限を備えた監査ではない。[適用記録](security-skill-review.md)を参照。
- 固定認証コードは本人確認にならず、ローカルHTTP専用。LAN/クラウドへ公開しない。メール存在案内、inline style、写真削除失敗時の孤児ファイル、高負荷競合の検証不足は [セキュリティ資料](security.md) に記載。
- 未保存入力・失敗写真の一時保持はブラウザ終了で失われる。ブラウザ内への永続ドラフト保存は実装していない。
- Python標準helperの補助キャッシュ1件がプロジェクト外に残る。削除はポリシーで拒否され、再削除していない。[場所と影響](skills.md)を記録した。
