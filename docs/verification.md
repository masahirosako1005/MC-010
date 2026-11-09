# 最終検証記録

実施日: 2026-11-09（Asia/Tokyo）。アプリ・検証スクリプトの確認版: `86e99a9`（取込 `8cb8b25`、UI `7f9d1de`、Windows起動 `126e6de`、Vite制限 `0757fb4`、レビュー修正 `b9ff878` を含む）。資料・証跡の追加後に最終差分も確認する。

## 実行した検証

|確認|実行と結果|
|---|---|
|環境|Node 26.13.0 / PostgreSQL 17.11 / Edge 157.0.4341.42。詳細は [技術資料](technology.md)。|
|型|`npm run check` 成功。client/sharedとserverをTypeScriptで検査。|
|ビルド|`npm run build` 成功。サーバーJSとSPAを生成し、`npm start` から配信。|
|単体・DB統合|`TEST_DATABASE_URL` 指定の `npm test`。4ファイル・46件合格、skipなし。API10件を含む。|
|ブラウザ|`E2E_BASE_URL=http://127.0.0.1:3003 npm run test:e2e`。PC4件＋スマホ4件、計8件合格、最終33.3秒。初回空DBの実行も8件合格。|
|依存監査|`npm audit --json`。prod/devを含み計0件。将来の脆弱性がない保証ではない。|
|固定スキル|`node scripts/skill-inventory.mjs`。286ファイル・23スキルのSHA256一致。公式3checkoutのHEADも固定SHAと一致。|
|依存再現|空の `.local/dependency-verify-final` にpackage/lockだけをコピーし、Node26で `npm ci --ignore-scripts`。SharpのPNG生成・デコード確認。|
|Windows DB起動|別の空クラスタで同梱windows-db.ps1のinit/start/status→migration/seed→stopが成功。fixture3人・4訪問を確認。|
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

## 未検証・残存事項

- 実機iPhone/Android、Safari、スクリーンリーダー、200%ブラウザズーム、実機のソフトキーボードとの共存は未検証。WCAG完全適合とは主張しない。
- Docker構成は未実行。検証済みのPostgreSQL経路はWindows公式バイナリによるローカル起動。
- Cloudflare Security Auditの正式6段階完全監査は **incomplete / missing_os_enforced_sandbox**。通常テストとソースレビューは実施済みだが、OS隔離・資源強制制限を備えた監査ではない。[適用記録](security-skill-review.md)を参照。
- 固定認証コードは本人確認にならず、ローカルHTTP専用。LAN/クラウドへ公開しない。メール存在案内、inline style、写真削除失敗時の孤児ファイル、高負荷競合の検証不足は [セキュリティ資料](security.md) に記載。
- 未保存入力・失敗写真の一時保持はブラウザ終了で失われる。ブラウザ内への永続ドラフト保存は実装していない。
- Python標準helperの補助キャッシュ1件がプロジェクト外に残る。削除はポリシーで拒否され、再削除していない。[場所と影響](skills.md)を記録した。
