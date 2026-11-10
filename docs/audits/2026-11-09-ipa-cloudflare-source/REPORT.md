# MC-010 Web・APIの安全性確認レポート

> 総合状態: **incomplete（Web／API実行監査）**
> 監査は途中です。プログラムの記述を読む確認は完了し、実際の画面・APIの動作は未確認です。

プログラムの記述を調べた範囲では、修正が必要だと確定した問題はありません。ただし、運用方法などの確認が6項目残り、実際の画面とAPI（画面からの操作を受け付ける窓口）の検査もできていません。安全に利用できるという最終判断は、まだ出せません。

対象は2026年11月9日の監査時点のプログラムです。今回は説明を読みやすくしたもので、再監査や修正後の動作検査は行っていません。「監査が完了したか」と「安全かどうか」は別の意味です。

## 対応は必要ですか？

**はい。まず利用範囲を確認し、残っている検査を担当者へ依頼してください。**

現時点で確定した不具合に対する修正指示はありません。一方、確認待ちの内容があるため「何もしなくてよい」とは判断できません。特に、他の人へ公開する場合や本物の個人情報を扱う場合は、下の「対応1」を先に確認してください。

確認した範囲で問題なし**10項目**（OK：プログラムの記述で確認）

問題が確定**0項目**（NG：修正が必要と確定したもの）

追加の確認が必要**6項目**（要確認：運用などの事実が不足）

検査できていない**2項目**（未実施：画面とAPIの動作検査）

該当する機能なし**2項目**（対象外：今回の検査対象にない）

確認待ちの6項目は、同じ原因や確認先を持つため、下の4つの作業（対応1〜4）にまとめています。未実施の2項目は対応5にまとめています。作業の順序は提案であり、問題の深刻度を確定したものではありません。

## 誰が、いつ、何をすればよいか

### 対応1：このパソコンだけで使っているかを確認

最初に確認。他の人への公開・本物の個人情報の投入より前に実施

**担当：**利用責任者と、パソコン・ネットワークの管理担当者

**理由：**ログインコード「1111」などは、このパソコン内のデモ利用を前提としています。外から使える状態では、本人確認の強さが足りなくなるおそれがあります。

- 同じパソコンだけで使うのか、社内・インターネットから使うのかを確認する。

- 外部から接続できる設定、パソコンの共用、本物の個人情報の使用がないかを管理担当者に確認する。

- 公開・共有利用を予定する場合は、固定コードを使わない本人確認、通信の暗号化、環境ごとの認証情報へ変更してから再確認する。

**完了の目安：**利用範囲とデータの種類を記録し、管理担当者が接続設定を確認できたこと。公開する場合は変更後の動作確認も必要です。

関連：NV-01（IPA-1.4、SUP-03、SUP-06）

### 対応2：画像処理と使用部品の既知の問題を確認

公開・本格運用の判断前に実施

**担当：**開発担当者

**理由：**画像の大きさなどには制限がありますが、画像を読み込む部品や、現在使用している部品一式の既知の欠陥は確認できていません。

- 使用している部品と版を、公開されている不具合・脆弱性の情報と照合する。

- 問題が見つかった場合は、このアプリへの影響を調べ、該当する部品を更新する。

- 実際の写真を使わず、検査用の画像で、壊れた画像などを安全に拒否できるか隔離環境で確認する。

**完了の目安：**確認した部品の版、該当する問題の有無、必要な更新と検査結果が記録されていること。更新が必須かどうかは照合後に判断します。

関連：NV-02（IPA-1.10、SUP-05）

### 対応3：データを守り、バックアップから戻せるかを確認

本物のデータを預かる前に実施

**担当：**システム運用担当者と、データ管理責任者

**理由：**保護の設定や復旧手順はプログラム・文書で確認しましたが、実際の設定と復元結果は確認できていません。

- 運用する環境でも、画面や通信の保護設定が有効か確認する。

- データの閲覧・変更権限と、バックアップを扱える人を必要な範囲に限定する。

- バックアップの暗号化と保存期間を確認し、別の検査用環境でデータと写真を同じ時点に戻す練習をする。

**完了の目安：**権限・保管方法を記録し、データと対応する写真が復元後も表示できた証拠があること。

関連：NV-03（SUP-06）

### 対応4：利用や画像処理が重なったときの上限を決める

利用人数を増やす前・大きなデータを取り込む前に実施

**担当：**開発担当者と、システム運用担当者

**理由：**1回の操作の制限はありますが、画像処理が同時に走る場合や、取り込むデータ全体が大きい場合の負担は未確認です。

- 想定する同時利用数と、取り込むデータ量を決める。

- 検査用データを少量から増やし、隔離環境で処理時間やメモリー使用量を測る。

- 測定結果に応じて、同時処理数・データ量・待ち時間の上限と、停止時の復旧手順を決める。

**完了の目安：**想定する利用量、測定結果、採用した上限と復旧手順が記録されていること。現在の上限で十分かは測定後に判断します。

関連：NV-04（CFSA-AVAIL-01）

### 対応5：検査専用の環境を用意し、画面とAPIを実際に確認

動作を含めた監査を完了するために必要

**担当：**開発担当者と、検査環境を用意する担当者

**理由：**現在の環境には、検査の影響を閉じ込める仕組みがありません。そのため、画面操作とAPIの実行検査を行っていません。

- 外部への通信・書き込み先・処理量・実行時間を制限できる検査専用環境を用意する。

- 本物のデータと切り離したデータベース、架空の利用者、画像保存先を用意する。

- ログイン・ログアウト、他人のデータへのアクセス拒否、不正な操作や画像の拒否、保存・再生成・共有を確認する。

**完了の目安：**画面とAPIそれぞれに実施日・検査対象・合否・証拠が残り、失敗があれば修正して再確認できていること。

関連：CFSA-WEB-RUNTIME-01、CFSA-API-RUNTIME-01

## 何を調べ、どう判断したか

「OK」はプログラムの記述を読んだ範囲の判断です。実際に操作して確かめた結果ではありません。追加の作業がある場合は、上の対応番号を参照してください。

|管理番号|調べたこと|判定|判断の理由|必要な対応|
|---|---|---|---|---|
|IPA-1.1|入力でデータベースを不正に操作できないか|OK|入力値を命令文と分けて扱う仕組みがあります。|今回、追加の修正指示はありません。|
|IPA-1.2|入力でパソコンの命令を勝手に実行できないか|対象外|入力からパソコンの命令を実行する機能がありません。|現在は不要。機能を追加したときに確認します。|
|IPA-1.3|許可されていないファイルを読み書きできないか|OK|写真の名前をシステムが決め、保存先を制限しています。|今回、追加の修正指示はありません。|
|IPA-1.4|ログインした本人を適切に確認できるか|要確認|ログイン状態を守る仕組みはありますが、固定コードはパソコン内のデモ利用が前提です。|対応1：利用範囲を確認|
|IPA-1.5|コメントなどに危険な命令を入れられないか|OK|入力内容を、実行する命令ではなく文字として表示します。|今回、追加の修正指示はありません。|
|IPA-1.6|別のサイトから勝手に保存などをさせられないか|OK|操作の送信元と、正規の操作を示す印を確認します。|今回、追加の修正指示はありません。|
|IPA-1.7|通信の付加情報に不正な内容を混ぜられないか|OK|返信する付加情報は決めた値を使い、入力をそのまま転用しません。|今回、追加の修正指示はありません。|
|IPA-1.8|メールの宛先などを不正に変えられないか|対象外|メール送信機能がありません。|現在は不要。メール送信を追加したときに確認します。|
|IPA-1.9|偽の画面に重ねて、意図しない操作をさせられないか|OK|他のサイトの枠内にこの画面を表示させない設定があります。|今回、追加の修正指示はありません。|
|IPA-1.10|壊れた画像などで画像処理の部品に問題が起きないか|要確認|画像の制限はありますが、部品の既知の問題と実際の拒否動作は未確認です。|対応2：部品と画像処理を確認|
|IPA-1.11|他人の写真や管理者用の機能を勝手に使えないか|OK|ログインした人・データの持ち主・管理者の権限を確認します。|記述上の修正指示はありません。実際の拒否動作は対応5で確認します。|
|SUP-01|別のサイトからデータを読み取られないか|OK|別のサイトにデータを読み取らせる許可を出していません。|今回、追加の修正指示はありません。|
|SUP-02|ブラウザーに情報が残ったり外に伝わったりしにくいか|OK|通信内容の保存や他のサイトとの情報のやり取りを制限しています。|今回、追加の修正指示はありません。|
|SUP-03|パスワードなどの設定を適切に扱っているか|要確認|秘密を公開しない工夫はありますが、デモ用の設定で運用していないか確認が必要です。|対応1：利用範囲と設定を確認|
|SUP-04|エラー表示や記録に個人情報が出ないか|OK|画面へのエラーと記録に出す内容を限定しています。|今回、追加の修正指示はありません。|
|SUP-05|使用しているソフトウェア部品に既知の問題がないか|要確認|部品の版は固定していますが、現在の組み合わせと公開情報の照合は未実施です。|対応2：既知の問題と照合|
|SUP-06|実際の接続設定・データの権限・復旧方法は適切か|要確認|設定と手順はありますが、実際の環境と復元結果を確認できていません。|対応1：接続範囲と対応3：権限・復旧を確認|
|CFSA-AVAIL-01|処理が重なって止まったり、保存先が一杯になったりしないか|要確認|1回の制限はありますが、全体の負担や同時処理の上限は未確認です。|対応4：測定して上限を決定|
|CFSA-WEB-RUNTIME-01|実際の画面操作で安全に動くか|未実施|検査の影響を閉じ込める専用環境がありません。|対応5：環境を用意して検査|
|CFSA-API-RUNTIME-01|画面からの操作を受ける窓口が不正な要求を拒否するか|未実施|検査の影響を閉じ込める専用環境がありません。|対応5：環境を用意して検査|

## この結果を読むときの注意

**調べた方法：**プログラムの記述と設計・運用文書を読みました。実際の画面操作やAPIの呼び出しはしていません。

**未実施の理由：**検査の影響を閉じ込める専用環境が用意できなかったためです。アプリに欠陥が見つかったという意味ではありません。

**基準：**IPA（情報処理推進機構）の11分類と、Cloudflareが公開した確認手法を使っています。Cloudflareサービスの契約設定や防御設定を調べた結果は含みません。

**情報の扱い：**本物の個人情報、利用者の写真、秘密の設定ファイルは開いていません。

**詳しい確認：**以下の欄に、根拠となるファイルの場所や、開発担当者向けの技術的な説明を残しています。

## 開発・運用担当者向けの詳しい記録

以下は、元の監査の根拠と技術的な記録です。今回の更新では説明のみを変更し、再監査・修正・動作検査は行っていません。

## 実行情報

|項目|値|
|---|---|
|ソース監査日時|2026-11-09T14:30:41+09:00|
|Web／API実行監査試行日時|2026-11-09T16:08:50+09:00|
|リポジトリ|MC-010|
|Source ref|`fd96b61c062e3bb80bfcd1a50c0a8d4d73b59d59`|
|ブランチ|`codex/pnpm-migration`|
|Worktree|dirty（開始時5エントリ）。対象アプリの安全なパスには差分なし。監査スキル／文書の未コミット変更はSHAに含まれない|
|プロファイル|`source`＋Web／API runtime extension（未完了）|
|実行モード|ソース監査のみ完了。アプリ、テスト、ビルド、ブラウザ、fixture、DB、画像parserは実行していない|
|許可された境界|ローカルリポジトリのアプリソース、schema/migration、manifest/lockfile、関連設計・セキュリティ文書の読取監査|
|除外|`Password*`、`.env*`、元CSV、DB実データ、実値の氏名／メール／自由回答、uploads、写真、生成物、liveサービス、Cloudflare control plane|
|Incomplete reason|`missing_os_enforced_sandbox`。Docker／Podman／Windows Sandbox／runsc／firejail／nsjail／bwrapは利用不可。`wsl.exe`は存在するがLinux distribution未導入。外部network遮断、空allowlist環境、read-only target、scratch限定書込、資源／時間上限を同時に強制できない|

## 判定サマリー

|OK|NG|要確認|未実施|対象外|
|---:|---:|---:|---:|---:|
|10|0|6|2|2|

## コンポーネント状態

|コンポーネント|要求|実行|状態|対象範囲|証拠|未検証・gap|
|---|---|---|---|---|---|---|
|`ipa-checklist`|yes|yes|complete|IPA 1.1〜1.11、SUP-01〜06のソース監査|下記18ソース項目、`src/server`、`src/client`、`db/migrations`、manifest／lockfile、関連docs|要確認6項目を候補NV-01〜04へ集約。Web／APIのruntime検証は未実施|
|`cloudflare-source`|yes|partial|incomplete|web/auth、data isolation、client、memory/native、supply chain、deployment、availability＋Web／API runtime extension|Cloudflare-authored companion観点、framework mapping、sandbox capability check|OS強制sandboxがないためWeb／API runtime 2項目を未実施。full audit、独立検証、deployment観測も未実施|

## フレームワーク対応

|フレームワーク／分類|対象項目|状態|根拠・制約|
|---|---|---|---|
|IPA公式11分類|`IPA-1.1`〜`IPA-1.11`|完了：OK 7、要確認 2、対象外 2|IPA「安全なウェブサイトの作り方」第1章の11分類|
|補足観点|`SUP-01`〜`SUP-06`|完了：OK 3、要確認 3|CORS、browser isolation、秘密、ログ、依存、deployment／backup。IPA公式分類とは別|
|Cloudflare-authored source methodology|既存項目への`CFSA:*` mapping＋`CFSA-AVAIL-01`|source review complete|Cloudflare製品／アカウント監査ではない。full auditの6 phase、agent独立検証は未実施|
|Web／API runtime extension|`CFSA-WEB-RUNTIME-01`、`CFSA-API-RUNTIME-01`|incomplete：未実施 2|OS強制sandboxの必須5条件を満たせず、接続・起動・test・browser操作を中止|

## Web／API実行監査

|対象|要求|実行|判定|予定していた確認|実行しなかった理由|再開条件|
|---|---|---|---|---|---|---|
|Webブラウザ|yes|no|未実施|dummy利用者でlogin／logout、CSP・frame拒否、XSS文字列のtext描画、CSRF、編集・保存・再生成・共有、画像upload制限、PC／スマホ表示|対象コード／ブラウザ／fixtureを安全に実行するOS強制sandboxがない|外部network遮断、loopback限定、空allowlist環境、read-only target、scratch限定書込、CPU／memory／process／file／disk／wall-clock上限を備える|
|API|yes|no|未実施|health、認証、session失効、role gate、2利用者間IDOR、revision競合、Origin＋custom header、画像MIME／size／dimension、error非漏えい|同上。共有DB、利用中DB、実データへ接続せずに検証できる隔離環境もない|上記sandboxに加え、専用の空PostgreSQL DB、dummy seed、専用upload directoryを用意する|

capability checkではDocker、Podman、Windows Sandbox、runsc、firejail、nsjail、bwrapが見つからず、WSLはdistribution未導入でした。したがってlive port 3001の参照や既存アプリへの軽いprobeも行っていません。既存の候補testは `tests/api.test.ts`、`tests/e2e/brochure.spec.ts`、`tests/e2e/admin.spec.ts` に確認できましたが、列挙だけで実行していません。

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
|CFSA-WEB-RUNTIME-01|CFSA:client-side, CFSA:web-auth-session|Web runtime|browser経由の認証、画面描画、mutation、保存、画像、response policy|OS強制sandbox内でPlaywright＋dummy DBを実行する計画|no|未実施|必須sandboxを構成できず、対象アプリやブラウザを実行していない|sandbox capability check：Docker／Podman等なし、WSL distributionなし|compliant sandbox＋専用DB／uploadで `pnpm run test:e2e` の対象ケースを実行|
|CFSA-API-RUNTIME-01|CFSA:web-auth-session, CFSA:data-isolation, CFSA:web-protocol|API runtime|認証、session、CSRF、role／owner境界、revision、画像、error|OS強制sandbox内でVitest＋専用空DBを実行する計画|no|未実施|必須sandboxを構成できず、API、port 3001、DBへ接続していない|sandbox capability checkと `tests/api.test.ts` のtest名列挙|compliant sandbox＋専用DB／uploadで `pnpm test` のAPI対象を実行|

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

確定したNGはありません。これはソース監査の範囲です。Web／API実行監査は未実施であるため、runtimeでNGがないという意味ではなく、deploymentやCloudflare full auditへも安全性を外挿しません。

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
- Web／API実行監査は `missing_os_enforced_sandbox` により未完了です。capability check自体は対象コードを実行しないread-only確認だけです。
- 利用可能なsandbox候補を確認した結果、Docker／Podman／Windows Sandbox／runsc／firejail／nsjail／bwrapは利用不可、WSLはdistribution未導入でした。
- 現行lockfileの外部advisory照会は、ambient資格情報や外部送信を伴わない保証がないため実行していません。
- Cloudflare account、WAF、DNS、CDN、Workers、dashboard、API token、edge ruleは監査していません。
- Cloudflare full auditに必要なOS強制sandbox、multi-phase agent hunting、独立candidate validation、structured validatorは実施していません。
- 対象外: OS command surface、mail送信surface。

## 成果物と再現情報

- 成果物: `REPORT.md`、`REPORT.html`。
- inspected source: `src/server`、`src/client`、`src/shared`、`db/migrations`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`.npmrc`、`compose.yaml`、`vite.config.ts`、関連docs。
- source search: SQL/query、process launch、filesystem path、HTML/DOM sink、browser storage/message、header/cookie/CORS、logging/env、native/parser surfaceを`rg`で列挙し、該当sourceを行単位で追跡。
- source ref: `fd96b61c062e3bb80bfcd1a50c0a8d4d73b59d59`。監査開始時dirtyであり、SHAは未コミットの監査スキル／文書を表さない。対象アプリの安全なパスには差分がなかった。
- report counts: 20 canonical items = OK 10 + NG 0 + 要確認 6 + 未実施 2 + 対象外 2。

## 出所

- IPA「安全なウェブサイトの作り方」改訂第7版の11分類: <https://www.ipa.go.jp/security/vuln/websecurity/about.html>
- Cloudflare-authored `security-audit` methodology: <https://github.com/cloudflare/security-audit-skill>
- project vendor revision: `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8`（`docs/skills.md`／`docs/skill-installation.json`）。Cloudflare product/account監査ではありません。
- 生成元: project-local `web-security-audit` source profile、2026-11-09。

