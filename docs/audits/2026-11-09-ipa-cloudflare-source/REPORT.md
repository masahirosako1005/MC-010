# MC-010 IPA＋Cloudflareソース監査レポート

> 総合状態: **complete（sourceプロファイル）**  
> `complete`は、指定したソース監査工程が完了したことを示します。脆弱性がないこと、Cloudflareアカウント／WAF／DNS／CDNを監査したこと、またはCloudflare full auditが完了したことを意味しません。

IPA公式11分類と6つの補足観点、およびCloudflare-authored `security-audit` の信頼境界ベース手法で現行ソースを確認しました。確定したNGは0件です。実配備とローカルデモ境界、native画像処理と依存advisory、復旧運用、集約資源制御はソースだけでは確定できないため、4件の要確認候補に整理しました。

## 実行情報

|項目|値|
|---|---|
|実行日時|2026-11-09T14:30:41+09:00|
|リポジトリ|MC-010|
|Source ref|`fd96b61c062e3bb80bfcd1a50c0a8d4d73b59d59`|
|ブランチ|`codex/pnpm-migration`|
|Worktree|dirty（開始時5エントリ）。対象アプリの安全なパスには差分なし。監査スキル／文書の未コミット変更はSHAに含まれない|
|プロファイル|`source`|
|実行モード|source-only。アプリ、テスト、ビルド、ブラウザ、fixture、DB、画像parserは実行していない|
|許可された境界|ローカルリポジトリのアプリソース、schema/migration、manifest/lockfile、関連設計・セキュリティ文書の読取監査|
|除外|`Password*`、`.env*`、元CSV、DB実データ、実値の氏名／メール／自由回答、uploads、写真、生成物、liveサービス、Cloudflare control plane|
|Incomplete reason|—（sourceプロファイルは完了。`full`は未要求・未実施）|

## 判定サマリー

|OK|NG|要確認|未実施|対象外|
|---:|---:|---:|---:|---:|
|10|0|6|0|2|

## コンポーネント状態

|コンポーネント|要求|実行|状態|対象範囲|証拠|未検証・gap|
|---|---|---|---|---|---|---|
|`ipa-checklist`|yes|yes|complete|IPA 1.1〜1.11、SUP-01〜06|下記18項目、`src/server`、`src/client`、`db/migrations`、manifest／lockfile、関連docs|要確認6項目を候補NV-01〜04へ集約|
|`cloudflare-source`|yes|yes|complete|web/auth、data isolation、client、memory/native、supply chain、deployment、availability|Cloudflare-authored companion観点と下記framework mapping|OS強制sandboxを使うfull audit、独立検証、runtime／deployment観測は未実施|

## フレームワーク対応

|フレームワーク／分類|対象項目|状態|根拠・制約|
|---|---|---|---|
|IPA公式11分類|`IPA-1.1`〜`IPA-1.11`|完了：OK 7、要確認 2、対象外 2|IPA「安全なウェブサイトの作り方」第1章の11分類|
|補足観点|`SUP-01`〜`SUP-06`|完了：OK 3、要確認 3|CORS、browser isolation、秘密、ログ、依存、deployment／backup。IPA公式分類とは別|
|Cloudflare-authored source methodology|既存項目への`CFSA:*` mapping＋`CFSA-AVAIL-01`|source review complete|Cloudflare製品／アカウント監査ではない。full auditの6 phase、agent独立検証、runtime検証は未実施|

## 監査項目

|ID|Frameworks|区分|監査対象|監査方法|実施|判定|判定理由|証拠|未検証・gap|
|---|---|---|---|---|---|---|---|---|---|
|IPA-1.1|IPA-1.1, CFSA:data-isolation|SQLインジェクション|API、管理集計、CSV取込、migration管理|入力からquery sinkまでsource trace|yes|OK|HTTP／CSV由来の値は`$1`等へ分離。管理画面の動的`where`は固定文字列だけで、値はparameter配列。migration SQL実行対象はrepo内固定ディレクトリの管理ファイル|`src/server/app.ts:71-75,83`; `src/server/admin.ts:85-101`; `src/server/brochures.ts:13-24,52-53,74-80`; `src/server/importer.ts:435-505`; `src/server/db-cli.ts:9-16`|runtime DB testは未実施|
|IPA-1.2|IPA-1.2, CFSA:supply-chain|OSコマンド・インジェクション|Web/API、importer、server scripts|process-launch sinkとpackage scriptをsource search|yes|対象外|対象アプリに`child_process`／shell実行sinkがなく、package scriptsも固定コマンド。HTTP／CSV入力からOS commandへ至る面がない|`package.json:11-22`; `src/server`全体のprocess-launch sink search結果0件|将来converter／外部コマンドを追加した場合は再監査|
|IPA-1.3|IPA-1.3, CFSA:data-isolation|ディレクトリ・トラバーサル|写真保存／取得、CSV取込、migration読取|path生成・正規化・入力源をtrace|yes|OK|写真keyはserver生成UUID＋`.webp`、正規表現と`path.resolve`後の親一致を要求。CSVはoperator指定directoryから固定ファイル名だけ、migrationはrepo内固定dirから`.sql`だけを読む|`src/server/app.ts:39-46,94-95,113-118,127-162`; `src/server/importer.ts:291-304`; `src/server/db-cli.ts:9-16`|filesystem symlink／Windows raceのruntime検証は未実施だが、Web入力はpathを選択できない|
|IPA-1.4|IPA-1.4, CFSA:web-auth-session|セッション管理|login、cookie、session lookup／logout|認証情報の発行・保存・失効・transportをtrace|yes|要確認|32byte乱数token、DBにはSHA-256、12時間、HttpOnly／SameSite=Strict、logout失効は確認。固定コード1111と`Secure=false`はsingle-host local demo前提であり、実配備境界が崩れると本人確認にならない|`src/server/app.ts:61-87`; `src/server/index.ts:3-7`; `docs/security.md:7-12,73-80`|NV-01：loopback限定、共有端末／proxy／port-forwardなし、実データ非使用を運用者確認|
|IPA-1.5|IPA-1.5, CFSA:client-side|XSS|コメント、アンケート、町登録spot、生成文、error表示、PNG DOM|browser source→render sink trace|yes|OK|通常のReact text描画を使用し、HTML実行sinkは検出されない。spot画像は固定assetまたは認可付きAPI pathへ制限。CSPはscript self、base/object禁止|`src/client/App.tsx:1054-1088,1124-1203,1213-1217`; `src/client/AdminDashboard.tsx:194-211`; `src/server/admin.ts:18-30`; `src/server/app.ts:47-50`|`style-src 'unsafe-inline'`は残るが、source上のHTML injection経路は確認されない|
|IPA-1.6|IPA-1.6, CFSA:web-auth-session|CSRF|全state-changing `/api` route|ambient cookie、Origin、custom header、SameSiteをtrace|yes|OK|非GET/HEAD/OPTIONSは許可Originと`X-Requested-With: kondo`を両方要求。clientはmutationでheaderを付与し、session cookieはSameSite=Strict|`src/server/app.ts:52-60,76`; `src/client/App.tsx:66-83`; `src/client/AdminDashboard.tsx:8-15`|proxyがOrigin／Hostを変更する配備はNV-01で確認|
|IPA-1.7|IPA-1.7, CFSA:web-protocol|HTTPヘッダ・インジェクション|global headers、cookie、content type、If-Match|untrusted値からresponse header sinkをtrace|yes|OK|response security headers、cookie属性、画像Content-Typeは固定。`If-Match`は整数化してDB revision比較にだけ使い、response headerへ転送しない|`src/server/app.ts:47-57,76,89-118,162`|実proxyのheader追加／上書きはNV-03|
|IPA-1.8|IPA-1.8|メールヘッダ・インジェクション|mailer／MIME送信|manifestとsourceのmail surface search|yes|対象外|mailer依存、SMTP、メール送信、raw MIME header構築がない。emailはlogin識別子とimport値としてのみ使用|`package.json:24-52`; `src/server/app.ts:69-72`; `src/server/importer.ts:163-169`|メール機能追加時は再監査|
|IPA-1.9|IPA-1.9, CFSA:client-side|クリックジャッキング|全画面／認証済み操作|frame policyとUI actionをtrace|yes|OK|全responseへ`X-Frame-Options: DENY`とCSP `frame-ancestors 'none'`を設定|`src/server/app.ts:47-50`|実proxyがheaderを保持するかはNV-03|
|IPA-1.10|IPA-1.10, CFSA:memory-binary, CFSA:supply-chain|バッファオーバーフロー／native parser|Sharp/libvips画像decode、transitive native binary|native境界、入力上限、lockfileをtrace|yes|要確認|5MB、magic/MIME一致、2400万画素、6000px、単一静止画に制限してWebP再encodeするが、untrusted bytesはnative Sharp境界へ到達する。現行lockfile advisoryとisolated sanitizer/runtime挙動は未確認|`src/server/app.ts:20-36,127-143`; `package.json:30,34`; `pnpm-lock.yaml:38-40,1149-1155`|NV-02：credential-free advisory確認とOS sandbox内のbounded画像parser検証|
|IPA-1.11|IPA-1.11, CFSA:data-isolation, CFSA:web-auth-session|アクセス制御／認可|visitor brochure/photo、town admin、official spot photo|session principal→route→query/storageをtrace|yes|OK|利用者IDはsessionから設定。brochure query／updateは`user_id`、item/photoはbrochure owner joinで制限。管理routerは`town_admin`を要求し、visitor APIはvisitor roleを要求。公式spot photoは仕様どおり全ログイン利用者向け|`src/server/app.ts:79-90,120-162`; `src/server/admin.ts:49-54`; `src/server/brochures.ts:13-34,56-75`; `docs/database.md:54-70`|DB統合／2 principal runtime testはsource profileでは未実施|
|SUP-01|SUP-01, CFSA:client-side|CORS／cross-origin|API responseとmutation|CORS header、credential mode、Origin policyをtrace|yes|OK|CORS許可headerを発行せずsame-origin fetchを使用。mutationにはexact Origin＋custom headerを要求し、credentialed cross-origin APIを有効化していない|`src/server/app.ts:52-60`; `src/client/App.tsx:66-74`; `src/client/AdminDashboard.tsx:8-12`|CORSを将来有効化する場合はorigin allowlistを再監査|
|SUP-02|SUP-02, CFSA:client-side|browser side-channel／isolation|CSP、frame、referrer、cache、opener/storage/worker|browser policyとfeature surfaceをtrace|yes|OK|APIは`no-store`、frame拒否、referrer拒否、script/connect self。service worker、postMessage、local/session storage、external openerは検出されず、現行機能でCOOP/CORP/COEPを必須にする具体的cross-origin経路は確認されない|`src/server/app.ts:47-53`; `src/client`のworker/message/storage/opener sink search結果0件|新規popup、embedding、cross-origin asset追加時は再評価|
|SUP-03|SUP-03, CFSA:cloud-deployment|秘密／環境設定|env loader、demo code、DB fallback、git除外|sourceとconfigのfail-safeを確認|yes|要確認|`.env`等はGit除外、応答／ログにtokenやSQLを出さない。反面、固定demo codeとlocal default DB資格情報はlocal-only運用に依存|`.gitignore:1-17`; `src/server/db.ts:1-6`; `src/server/app.ts:69-76,167-175`; `compose.yaml:4-9`|NV-01：実データ／共有環境へdemo設定を持ち出していないことを確認|
|SUP-04|SUP-04, CFSA:data-isolation|error／log／observability|API error middleware、CLI、DB error、admin audit log|data classとreaderをsource trace|yes|OK|APIは定型code/messageだけ返し、unexpected errorも定型503。server logへ入力本文・email・token・SQL・pathを出さない。admin audit logはactor/action/spot/timeだけ|`src/server/app.ts:167-175`; `src/server/db.ts:6`; `src/server/import-cli.ts:34-40`; `src/server/admin.ts:33-35`; `db/migrations/003_town_admin.sql:13-16`|外部log collector／retentionはsource対象外|
|SUP-05|SUP-05, CFSA:supply-chain|依存関係／supply chain|manifest、pnpm lock、build scripts|version pin、integrity、build allowlistを確認|yes|要確認|直接依存とpackage managerはexact pin、lockfileにintegrity、build許可は`esbuild@0.28.2`だけ。一方、現行pnpm lockに対するcredential-free advisory照会は未実施で、過去のnpm audit結果を現行lockへ外挿できない|`package.json:6-10,24-51`; `pnpm-lock.yaml:1-86`; `pnpm-workspace.yaml:1-2`; `.npmrc:1-2`; `docs/security.md:31,82-90`|NV-02：隔離した資格情報なし設定で現行lockのadvisoryを確認|
|SUP-06|SUP-06, CFSA:cloud-deployment, CFSA:data-isolation|deployment／TLS／backup／recovery|bind、Compose、DB privilege、backup docs|source intentと外部factを分離|yes|要確認|Node、Vite、Compose DBはsource上loopback bind。DB＋画像の同時点backup／restore手順は文書化。ただし実firewall、proxy、DB role、backup ACL／暗号化／復元結果はsourceから証明できない|`src/server/index.ts:3-7`; `vite.config.ts:6-12`; `compose.yaml:1-18`; `docs/database.md:50-58`; `docs/technology.md:36-38`|NV-01／NV-03：実配備と復旧証跡をowner確認|
|CFSA-AVAIL-01|CFSA:resource-exhaustion|資源枯渇／可用性|JSON、multipart、Sharp、login map、CSV importer|入力→CPU／memory／diskのsource boundをtrace|yes|要確認|JSON 512KB、画像5MB/1 file/2400万画素、login 30回/分などper-request boundはある。Sharp処理のaggregate concurrencyとCSV全体`readFile`の最大サイズ／回復挙動はsourceに明示されない|`src/server/app.ts:20,31-36,60-68`; `src/server/importer.ts:291-310,399-407`; `src/server/db.ts:2-5`|NV-04：OS sandbox内でdummy入力による小規模growth/concurrency計測と運用上限を確認|

## IPA 11項目対応表

|IPA ID|分類|判定|所見／候補ID|証拠|判定理由|
|---|---|---|---|---|---|
|IPA-1.1|SQLインジェクション|OK|—|`src/server/app.ts:71-75`; `src/server/admin.ts:85-101`|値はparameterへ分離|
|IPA-1.2|OSコマンド・インジェクション|対象外|—|`package.json:11-22`; process-launch sink 0件|入力からcommand sinkなし|
|IPA-1.3|ディレクトリ・トラバーサル|OK|—|`src/server/app.ts:39-46`|server生成key＋root confinement|
|IPA-1.4|セッション管理|要確認|NV-01|`src/server/app.ts:61-87`; `src/server/index.ts:3-7`|local demo外では固定code／非Secure cookie不適切|
|IPA-1.5|XSS|OK|—|`src/client/App.tsx:1124-1203`; `src/server/app.ts:47-50`|React text＋CSP、HTML sinkなし|
|IPA-1.6|CSRF|OK|—|`src/server/app.ts:52-60,76`|Origin＋custom header＋SameSite|
|IPA-1.7|HTTPヘッダ・インジェクション|OK|—|`src/server/app.ts:47-57,76`|response headerは固定値|
|IPA-1.8|メールヘッダ・インジェクション|対象外|—|`package.json:24-52`|mail送信surfaceなし|
|IPA-1.9|クリックジャッキング|OK|—|`src/server/app.ts:47-50`|XFO DENY＋frame-ancestors none|
|IPA-1.10|バッファオーバーフロー|要確認|NV-02|`src/server/app.ts:20-36`; `pnpm-lock.yaml:1149-1155`|native Sharp境界のruntime/advisory未確認|
|IPA-1.11|アクセス制御／認可|OK|—|`src/server/app.ts:79-162`; `src/server/admin.ts:49-54`|session principal、owner join、role gate|

## NG: 確定した問題

確定したNGはありません。これはsourceプロファイルの範囲であり、runtime／deploymentやCloudflare full auditへ安全性を外挿しません。

## 要確認: 候補と追加確認

### NV-01 — ローカルデモ境界と認証強度

- 関連: IPA-1.4、SUP-03、SUP-06、CFSA:web-auth-session／cloud-deployment
- source事実: server／Vite／Compose DBはloopback bind。固定コード1111、HTTP cookie `Secure=false`、local DB既定値を使用。
- 未確定事実: reverse proxy、port-forward、LAN公開、共有Windowsアカウント、実データ投入の有無。
- 安全な確認: 運用者がbind/firewall/proxy設定とデータ分類を画面・設定で確認する。共有／外部利用へ広げる場合は、固定コードを廃止して本人確認、TLS、`Secure` cookie、環境別secret、統一login errorへ変更する。

### NV-02 — Sharp/native境界と現行lockのadvisory

- 関連: IPA-1.10、SUP-05、CFSA:memory-binary／supply-chain
- source事実: 5MB・magic/MIME・pixel/dimension/page上限後にSharp 0.35.5でdecodeしWebP化。pnpm lockはintegrity付きでexact pin。
- 未確定事実: 現行pnpm lockの既知advisory、使用中native binary/libvips、対象platformでのmalformed画像処理。
- 安全な確認: credential-freeな隔離設定で現行lockのadvisoryを確認し、必要ならOS強制sandbox内だけで小さなdummy malformed画像を既存parser testへ通す。live appや実写真は使用しない。

### NV-03 — 実配備header・DB権限・backup/recovery

- 関連: SUP-06、CFSA:cloud-deployment／data-isolation
- source事実: security header、loopback bind、DB＋画像の同時点復旧手順は存在。
- 未確定事実: proxyがheaderを保持するか、DB roleが最小権限か、backupのACL／暗号化／retention、別環境への復元結果。
- 安全な確認: 運用者が非本番の専用環境でeffective response headers、DB grants、backup保管ACL、復元後の画像参照整合を確認する。live control planeを本監査からprobeしない。

### NV-04 — aggregate資源上限

- 関連: CFSA:resource-exhaustion
- source事実: request/file/pixel/loginには上限があるが、同時Sharp処理とCSV全体sizeのaggregate上限は明示されない。
- 未確定事実: process memory/CPU、同時request制御、CSVの運用最大size、監視／回復。
- 安全な確認: OS強制sandboxとdummy dataで少数のgrowth pointだけ測り、CPU/memory/time/concurrency limitを決める。shared appや実CSVへ負荷をかけない。

## 制約・対象外・未実施

- `Password*`、`.env*`、元CSV、DB実データ、実値の氏名／メール／自由回答、uploads、写真は開いていません。
- アプリ、DB、test、build、browser、image parser、fixture、live port 3001は実行していません。
- 現行lockfileの外部advisory照会は、ambient資格情報や外部送信を伴わない保証がないため実行していません。
- Cloudflare account、WAF、DNS、CDN、Workers、dashboard、API token、edge ruleは監査していません。
- Cloudflare full auditに必要なOS強制sandbox、multi-phase agent hunting、独立candidate validation、structured validatorは実施していません。
- 対象外: OS command surface、mail送信surface。

## 成果物と再現情報

- 成果物: `REPORT.md`、`REPORT.html`。
- inspected source: `src/server`、`src/client`、`src/shared`、`db/migrations`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`.npmrc`、`compose.yaml`、`vite.config.ts`、関連docs。
- source search: SQL/query、process launch、filesystem path、HTML/DOM sink、browser storage/message、header/cookie/CORS、logging/env、native/parser surfaceを`rg`で列挙し、該当sourceを行単位で追跡。
- source ref: `fd96b61c062e3bb80bfcd1a50c0a8d4d73b59d59`。監査開始時dirtyであり、SHAは未コミットの監査スキル／文書を表さない。対象アプリの安全なパスには差分がなかった。
- report counts: 18 canonical items = OK 10 + NG 0 + 要確認 6 + 未実施 0 + 対象外 2。

## 出所

- IPA「安全なウェブサイトの作り方」改訂第7版の11分類: <https://www.ipa.go.jp/security/vuln/websecurity/about.html>
- Cloudflare-authored `security-audit` methodology: <https://github.com/cloudflare/security-audit-skill>
- project vendor revision: `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8`（`docs/skills.md`／`docs/skill-installation.json`）。Cloudflare product/account監査ではありません。
- 生成元: project-local `web-security-audit` source profile、2026-11-09。

