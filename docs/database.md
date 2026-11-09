# DB・API・生成規則

## 公開URLコピー記録（008_share_copy_counts.sql）

`brochure_shares` に `copy_count`（非負integer、既存値0）と `last_copied_at` を追加。`share_url_copies` はshare_id/request_idの複合主キーとサーバー時刻のcopied_atを保存する。共有ID＋日付のindexを持つ。既存のアクセス記録・view_count・公開状態・トークンは変更しない。コピー時刻はサーバーが成功イベントを受理した時刻。

`POST /api/brochure/share/copies` は作成者専用。strict JSON `{shareId: UUID, requestId: UUID}` を受け、セッション本人の冊子の共有行をFOR UPDATEしてイベントをINSERT ON CONFLICT DO NOTHING、新規時だけコピー累計・最終日時を更新し `{ok:true}` を返す。存在しない／他人のshareIdは404、町アカウントは403、未ログインは401。公開停止後の遅延送信は記録するが再公開はしない。ブラウザのコピー確認イベントであり、実コピーの独立証明ではない。

作成者用ShareSettingsは対象を固定するためidも返す。町側共有一覧はcopyCount/lastCopiedAt、累計はtotalCopiesを追加。作成詳細のshareにも同項目、スポット分析のtotalsとperiodの日別／合計にはshareCopiesを追加する。スポットは現在掲載中の冊子だけを対象にする。コピー記録は本文を変更しないため公開コンテンツcacheの無効化対象から除外する。バックアップには新列・イベント表も含める。

## 管理用の作成詳細・スポット分析（2026-11-09追加）

既存の町権限middlewareの内側で次のGETを提供する。共通の認証・no-storeを適用し、UUIDとstrict queryを検証。取得はREPEATABLE READ / READ ONLY、SQLごとの上限8秒。DB migrationはない。

|メソッド・パス|契約|
|---|---|
|GET /api/admin/registrations/:id|idは匿名利用者UUID。scope=all/organizer/fixture、既定all。registrationに出所と訪問／スポット／スタンプ数・最終訪問、brochureに条件・日時・revision・再生成／掲載／思い出／写真／コメント数、itemsに掲載または選んだ思い出のスポット情報と写真有無・コメント有無／文字数、shareに公開状態・件数・日時。未作成はbrochure/share=null、items=[]。対象なし・町利用者・scope不一致は404。|
|GET /api/admin/spots/:id/analytics|idはスポットUUID。scope（既定all）、from/toは両方省略でJST直近30日、同時指定時1900〜2100年・最大366日。spotは公式情報、totalsは累計／現在の掲載・全冊数、breakdownsは現在掲載中の条件内訳、periodは指定日・日別値・期間合計、recentBrochuresは更新順最大10冊の匿名作成条件。存在しないスポットは404。|

型定義は `src/shared/admin-detail-types.ts`。利用者の氏名・メール・回答・本文・写真URL・クーポンコード・共有トークン／生URLは含めない。写真はEXISTS、コメントは有無とchar_lengthだけを取得する。掲載しおりの共有表示は現在そのスポットを選択している冊子の共有履歴であり、個別スポット閲覧イベントではない。初回作成は冊子のcreated_at、訪問はvisited_at、クーポンはclaimed_at、共有表示はviewed_atで日付を判定する。

## DB

PostgreSQL 17以降。`db/migrations/001_initial.sql` が初期構造、`002_brochure_pickup_categories.sql` が体験カテゴリ割当を追加する。起動時の自動DB変更はなく、CLIの `db:migrate` がmigration名とadvisory lockで冪等実行する。

|表|関連・用途|
|---|---|
|users|匿名利用者。external_id UNIQUE、正規化email UNIQUE nullable、fixture/organizerを分離。|
|auth_aliases|明示的デモ用仮メール→利用者。マスクメールを推測しない。|
|spots|元の7架空スポット＋専用CSVで追加するデモ10件。タグ・紹介・ローカル画像参照。実在位置情報なし。|
|visits|利用者→スポット、実訪問日時・スタンプ。source_key UNIQUEで冪等。|
|surveys|利用者全体の参加後アンケート。スポットに結合しない。|
|brochures|user_id UNIQUE。同行者・日数・過ごし方・テンプレ・生成文・revision。|
|brochure_items|冊子→スポット UNIQUE。selected/order/is_memory/commentとnullableのpickup_categoryを保持。選択中のカテゴリは冊子内UNIQUE。外してもDELETEしない。|
|item_photos|item_id UNIQUE、UUID.webp参照・形式・容量・SHA256。画像実体なし。|
|sessions|乱数セッションのSHA256のみ。12時間で失効。|
|import_runs|元ファイル全体ハッシュと匿名件数。raw個人情報を保存しない。|
|schema_migrations|適用済みmigration名。|

初回生成は利用者行を `FOR UPDATE` し、既存冊子を再確認してから作成する。DBのuser_id UNIQUEとトランザクションで二重生成を防ぐ。保存・再生成は冊子行ロックとrevision比較。競合時409で入力を保持する。写真は独立保存で、コメント保存payloadには写真フィールドを含めない。

## API契約

すべて `/api`。状態変更は許可Originと `X-Requested-With: kondo` が必要。cookieはHttpOnly/SameSite=Strict、ホストはローカル限定。利用者IDを入力に受け付けない。

|メソッド・パス|内容|
|---|---|
|POST /login|email/code。ユーザー、履歴、スポット、保存済み冊子を取得。|
|GET /session|同じ本人状態を復元。|
|POST /logout|セッション失効。|
|POST /brochure/ensure|本人初回だけ生成。履歴なし422、既存なら無変更。|
|PUT /brochure|revisionと全itemの明示編集。200字、選択1〜5、カテゴリ・順序重複、スポットタグ適合、所有者を検証。|
|POST /brochure/regenerate|現在draft＋条件を同一transactionで適用し、テーマ・候補・招待文を生成。|
|POST /items/:id/photo|multipart photo 1枚。本人所有itemのみ。|
|DELETE /items/:id/photo|本人の追加写真を解除。|
|GET /photos/:id|本人所有の画像だけ配信。|
|GET /health|DB疎通。|

エラーは `{error:{code,message}}`、内部パス・SQL・stackを返さない。photoは同一オリジン認可付きURL。共有は後述006の共有URLと対象写真用APIを使う。最新UIでは招待文欄・テキストコピー・PNG保存を削除したが、既存invitation生成/保存/返却の契約は維持する。

## 生成と保持

訪問履歴の実スポットと、当該利用者が一度も訪れていないスポットを明確に分離。「みる= 景色/海、あそぶ= 体験/町歩き/散歩/文化、たべる= 食、いやす= 休憩/自然、かう= 買い物」の固定タグ対応で、各カテゴリ最大1件を重複スポットなしで選ぶ。候補の少ないカテゴリから確保し、同行者タグ一致、アンケートの良かった点、旅スタイル、明示的な再訪選択をスコア化し、安定IDで同点処理する。不足カテゴリに架空候補を足さない。

良かった点のタグはmasterと同じ日本語（自然・景色・海・食・文化・体験）へ正規化する。総合満足度4以上の場合は訪問済みカテゴリに近い候補を加点し、欠損・低評価の場合は同カテゴリだからという加点をしない。利用者全体の評価を個別スポットの評価へ変換しない。

再生成は選択状態・カテゴリ割当・順序・生成理由だけを更新し、全itemのcomment/photo/templateを保持。個別変更は同カテゴリ内でselectedとpickup_categoryを付け替える。印象スポットは本人訪問済みからのみ選ぶ。一人の文面は勧誘表現を使わず旅紹介にする。日時・移動時間・営業情報は推測生成しない。

タイトルはshared/brochure-copy.tsの同行者別定型をcreate/save/regenerateで保存する。既存DBのtitleが従来の「同行者と、日帰り/一泊二日の旅」（一人は「自分のペースで、…」）に完全一致するときだけ、getBrochureの応答で新表現に変換する。任意の異なるタイトルは保持し、GETだけでDB・revisionを更新しない。タイトル以外の写真/コメント/選択状態を一括移行しない。ヘッダーの由来はisMemoryの訪問済みitemとスポット名から描画する。

## 復旧

ユーザー追加写真のDB参照と保存ディレクトリを同時点でバックアップ。アプリ停止→DBを専用DBへ復元→画像を同じUPLOAD_DIRへ復元→設定確認→起動。元CSV取り込みの再実行は冊子編集を変更しない。新規に試し直す場合は既存DBを削除せず、空の別DBを作る。

## 町側管理追加（003_town_admin.sql）

`users.account_role` はvisitor（既定）/town_admin。既存のsourceとは独立する。migration CLIは固定IDの町デモアカウントだけを追加し、既存アカウントの権限を昇格しない。ログイン・sessionはuser.roleを返し、町アカウントでは利用者向け配列を空で返す。認証middlewareは毎回usersの現在の役割を照合する。

spotsへactive/revision/updated_at、sourceへtownを追加。spot_photosは町の公式スポット画像の認可付き参照。admin_audit_logsはactor_id/action/spot_id/created_atのみ。写真実体はUPLOAD_DIRを共用し、利用者写真と異なるAPIで配信する。DBと画像は従来どおり同時点バックアップ。カタログseedはINSERT ON CONFLICT DO NOTHINGへ変更し、町の編集を上書きしない。

| メソッド・パス | 契約 |
|---|---|
| GET /api/admin/overview?scope=all | scope: all/organizer/fixture、匿名集計。公開スポット件数は常に全件。 |
| GET /api/admin/registrations | scope、status=all/created/missing、history=all/yes/no、page=1以上。25件/ページ。件数と一覧は同一read-only snapshot。 |
| GET /api/admin/spots | 全スポットと訪問件数・訪問人数・選択中掲載冊数。 |
| POST /api/admin/spots | name/category/description/themeTags/companionTags/image/activeと任意requestId（UUID）。同一操作者・操作IDの再送は既存スポットを返しreplayed=true、新規はfalse。画像は同梱画像から選択、登録後に写真追加可。 |
| PUT /api/admin/spots/:id | 上記とrevision。競合409、使用中pickup_categoryのタグ不適合409。削除APIなし。 |
| POST /api/admin/spots/:id/photo | multipart photo、If-Matchにrevision整数。画像正規化・行ロック・参照交換・監査ログ。 |
| GET /api/spot-photos/:id | ログイン済みの利用者・町アカウント向け公式画像。利用者個人写真の認可は変更しない。 |

管理APIは認証401／町権限なし403。利用者専用APIへ町アカウントからアクセスした場合も403。既存Origin/X-Requested-With制約を維持。POST ensure/regenerateはbrochureに加えspotsも返す。catalog変更の排他advisory lockと冊子更新の共有advisory lockでタグ変更と生成・保存を直列化する。新規スポットitemの追加は再生成transaction内のみで行い、GETや再ログインで既存編集を変更しない。

保存時のカテゴリ付替は、入力全体の検証後、同一transaction内でpickup_categoryを一度NULLにしてから再割当する。配列中の新旧itemの順番によってUNIQUE制約が途中衝突しない。再送された新規登録は監査create行も重複させず、他操作者の操作ID流用は409にする。

## プレゼント受取追加（004_spot_gift_claims.sql）

`spots.has_gift` はNOT NULL、初期値false。`spot_gift_claims` はid（UUID）、user_id、spot_id、claimed_at（DB時刻）を保持し、UNIQUE(user_id,spot_id)で一度限りとする。user/spotは外部キー、スポット・日時に索引を持つ。既存の訪問実績から受取を作らず、設定をオフにしても履歴を削除しない。QR・公開用トークンは生成しない。

| メソッド・パス | 契約 |
|---|---|
| GET /api/spots/:id/detail | 本人の冊子itemに存在するスポットだけ。最新のspot（hasGiftを含む）と本人のgiftClaim（なければnull）を返す。読み取りのみ。 |
| POST /api/spots/:id/gift-claim | 利用者専用。空JSON `{}`、セッション本人・DB時刻で記録。giftClaimとalreadyClaimedを返す。既存受取は同じ結果を返し、新規の公開停止・提供終了は409。 |
| GET /api/admin/gift-claims | 町専用。scope=all/organizer/fixture、任意spotId（UUID）、page。25件/ページ、同一read-only snapshotからtotal・users・rows・page・pageSize。rowsはid/spotId/spotName/userId/source/claimedAtのみ。 |

管理スポットGETへhasGiftとgiftClaimCount（全出所の受取件数）を追加。登録・更新は任意hasGiftを受け付け、登録省略時false、更新省略時は既存値を維持する。通常利用者のスポット返却もhasGiftを含む。受取transactionはcatalog共有advisory lockを取り、管理変更の排他lockと直列化する。INSERT ON CONFLICT DO NOTHINGと既存行の再取得により同時要求・再送で履歴を増やさない。本人ID・日時をpayloadへ指定できない。確認後の本人のPOSTだけで受取を記録し、GETや町の参照APIは履歴を変更しない。既存Origin/X-Requested-With、認証・役割境界を維持する。

この履歴は本人申告の受取であり、`visits` / `surveys` / 冊子の編集内容は変更しない。DBと写真のバックアップ時には新表も含める。

## クーポン表示への変更（005_spot_coupon_codes.sql）

最新のユーザー指示で画面上のプレゼント/受取をクーポン/利用へ変更した。上記004の物理名・APIパス・返却キーは互換性と既存設定/履歴維持のため変更しない。新表`spot_coupon_codes`はuser_id・spot_idの複合主キー、code（英大文字・数字6文字、UNIQUEとCHECK）、created_at（DB時刻）。表示したときに乱数で発行し、同一利用者・スポットには既存コードを返す。コード重複時は再生成、同時発行時は既存行を取得する。既存使用済みデータへのコードの後付けは行わない。

| メソッド・パス | 現在の契約 |
|---|---|
| POST /api/spots/:id/coupon | 空JSON `{}`。利用者専用、本人の冊子所属・公開・提供状態を確認。couponCode（文字列）とgiftClaim=null。既に使用済みならcouponCode=nullと既存giftClaim。コード発行は利用件数へ加算しない。 |
| POST /api/spots/:id/gift-claim | 空JSON `{}`。既存の本人・提供状態・一度限りの検証に加え、発行済みコードの存在を確認する。未発行409 coupon_not_displayed。既存履歴の再送は発行状態にかかわらず同じ履歴を返す。 |

画面では「クーポンを表示する」で新APIを呼び、確認画面の「使う」だけで利用用APIを呼ぶ。コードは認証用の秘密や引換用APIトークンとしては扱わず、すべての操作はセッション本人を照合する。コードだけで利用者を指定するAPIはない。詳細GETは読み取りのみ。作成者としてプレビューした場合も、明示的なクーポン表示操作でのみ発行する。コード発行もcatalog共有lockで管理変更と直列化する。管理履歴の件数・人数は従来の履歴表だけを集計し、表示済みの未使用コードを含めない。バックアップには新表も含める。

## 町管理MCP（007_admin_mcp_keys.sql）

`admin_mcp_keys`: id、owner_id（users外部キー）、label（1〜60字）、token_hash（SHA-256 hex64文字、UNIQUE）、created_at / expires_at / last_used_at / revoked_at。実値は32byte乱数と固定プレフィックスを用い、DBへ保存しない。本人のユーザー行ロックで有効5件の上限を直列化する。既存データや冊子を変更しない。

| メソッド・パス | 契約 |
|---|---|
| GET /api/admin/mcp/keys | セッション町権限。本人のキーを有効優先・作成降順で30件、endpoint / maxActiveKeys。ハッシュ・実値を返さない。 |
| POST /api/admin/mcp/keys | セッション町権限。label、days=7/30/90（省略30）。keyメタデータとtokenを201で一度だけ返す。上限409。 |
| DELETE /api/admin/mcp/keys/:id | セッション町権限、本人のキーだけ失効。再送しても失効日時を維持。対象なし404。 |
| POST /mcp | 専用Bearer認証。ループバックHost、Origin検証、32KB。stateless Streamable HTTPの初期化・tools/resources/prompts。Cookieだけでは接続不可。GET/DELETEは認証後405。 |

`/mcp` は通常APIのCookie/CSRF系と分離し、専用のHost/Origin制約を持つ。キーの期限・失効・所有者の現在のtown_admin権限を照合し、最終接続だけを更新する。認証失敗401、レート制限429。集計はREPEATABLE READ / READ ONLY・SQLごと8秒。キーで通常の更新APIを操作できない。6ツールと入力・応答・期間定義は [MCP契約](mcp.md)。

## 共有URL（006_brochure_shares.sql）

`brochure_shares`: id、brochure_id UNIQUE、token（32byte乱数のhex64文字、UNIQUE）、active、view_count（非負整数）、created_at、last_viewed_at。`share_page_views`: share_id + request_id（UUID）の複合主キーとDB時刻のviewed_at。URLは本人へだけ返し、ログ/町側一覧へ出さない。停止・再開してもトークンと件数を維持する。バックアップには両表を含める。

| メソッド・パス | 契約 |
|---|---|
| GET /api/brochure/share | 認証済み作成者。share（なければnull）。path/active/viewCount/createdAt/lastViewedAt。参照だけでは発行しない。 |
| POST /api/brochure/share | 空JSON。本人の保存済み冊子にURLを発行/再開。冊子UNIQUEのupsertで同時要求・再送でも同じURL。 |
| DELETE /api/brochure/share | 空JSON。本人の公開を停止しshareを返す。データと件数は保持。 |
| GET /api/shared/:token | 公開中URLのみ。brochureはselectedまたはvisitedかつisMemoryのitemだけ、spotsもその集合だけ。写真URLを書換え、viewerIsOwnerをセッション照合する。非所有者はhasGift=false。アカウント情報・全訪問・survey・クーポン状態/コードは返さない。GETで計測しない。 |
| GET /api/shared/:token/photos/:id | 公開URLと現在の対象itemを照合した個人写真。IDだけでは取得できず、非掲載itemは404。 |
| GET /api/shared/:token/spot-photos/:id | 同じ共有範囲の町側公式写真。 |
| POST /api/shared/:token/views | requestId（UUID）のみ。公開中share行をロックし、表示UUIDをINSERT ON CONFLICT DO NOTHING、新規時だけview_countとlast_viewed_atを更新。再送200、無効/停止URL404。 |
| GET /api/admin/shares | 町専用。scope=all/organizer/fixture、page。25件。匿名UUID/出所/公開状態/表示回数/発行・最終表示日時。発行数・公開数・累計表示回数と一覧は同一read-only snapshot。生URLは返さない。 |

公開ルーターは既存のHost・Origin・JSON/cookie処理後、必須認証middlewareの前へ置く。その他は認証後。全APIはno-store。公開本文はrepeatable-read read-only transactionで取得する。画像実体はUPLOAD_DIRのUUID.webpのまま、DB参照と固定形式のstorage_keyを照合して読み出す。クーポン表示/利用は共有トークンを受け付けず、従来のセッション所有者照合を維持する。

公開本文のmemoryVisitsは選択した訪問済み思い出の最新1件ずつに限定し、spotId/visitedAt/stampのみを返す。紙面の訪問日時とスタンプ表示を維持し、全履歴や回答本文は返さない。

SPAは本文表示後にページごとのUUIDで計測し、記録失敗時は同じUUIDで1回再試行する。リロードは新UUID、作者のプレビューは計測APIを呼ばない。JS無効・通信失敗で記録されない場合や、閲覧者によるリクエストの作成はあり得るため、実人数やボットを排除した厳密な人間閲覧の指標ではない。閲覧者ID・IP・User-Agentは保存しない。
