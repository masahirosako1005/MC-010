# DB・API・生成規則

## DB

PostgreSQL 17以降。`db/migrations/001_initial.sql` が初期構造、`002_brochure_pickup_categories.sql` が体験カテゴリ割当を追加する。起動時の自動DB変更はなく、CLIの `db:migrate` がmigration名とadvisory lockで冪等実行する。

|表|関連・用途|
|---|---|
|users|匿名利用者。external_id UNIQUE、正規化email UNIQUE nullable、fixture/organizerを分離。|
|auth_aliases|明示的デモ用仮メール→利用者。マスクメールを推測しない。|
|spots|7架空スポット、タグ・紹介・ローカル画像参照。実在位置情報なし。|
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

エラーは `{error:{code,message}}`、内部パス・SQL・stackを返さない。photoは同一オリジン認可付きURL、公開共有URLは作らない。共有はプレーンテキストとローカルPNGのみ。

## 生成と保持

訪問履歴の実スポットと、当該利用者が一度も訪れていないスポットを明確に分離。「みる= 景色/海、あそぶ= 体験/町歩き/散歩/文化、たべる= 食、いやす= 休憩/自然、かう= 買い物」の固定タグ対応で、各カテゴリ最大1件を重複スポットなしで選ぶ。候補の少ないカテゴリから確保し、同行者タグ一致、アンケートの良かった点、旅スタイル、明示的な再訪選択をスコア化し、安定IDで同点処理する。不足カテゴリに架空候補を足さない。

良かった点のタグはmasterと同じ日本語（自然・景色・海・食・文化・体験）へ正規化する。総合満足度4以上の場合は訪問済みカテゴリに近い候補を加点し、欠損・低評価の場合は同カテゴリだからという加点をしない。利用者全体の評価を個別スポットの評価へ変換しない。

再生成は選択状態・カテゴリ割当・順序・生成理由だけを更新し、全itemのcomment/photo/templateを保持。個別変更は同カテゴリ内でselectedとpickup_categoryを付け替える。印象スポットは本人訪問済みからのみ選ぶ。一人の文面は勧誘表現を使わず旅紹介にする。日時・移動時間・営業情報は推測生成しない。

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
| POST /api/admin/spots | name/category/description/themeTags/companionTags/image/active。画像は同梱画像から選択、登録後に写真追加可。 |
| PUT /api/admin/spots/:id | 上記とrevision。競合409、使用中pickup_categoryのタグ不適合409。削除APIなし。 |
| POST /api/admin/spots/:id/photo | multipart photo、If-Matchにrevision整数。画像正規化・行ロック・参照交換・監査ログ。 |
| GET /api/spot-photos/:id | ログイン済みの利用者・町アカウント向け公式画像。利用者個人写真の認可は変更しない。 |

管理APIは認証401／町権限なし403。利用者専用APIへ町アカウントからアクセスした場合も403。既存Origin/X-Requested-With制約を維持。POST ensure/regenerateはbrochureに加えspotsも返す。catalog変更の排他advisory lockと冊子更新の共有advisory lockでタグ変更と生成・保存を直列化する。新規スポットitemの追加は再生成transaction内のみで行い、GETや再ログインで既存編集を変更しない。
