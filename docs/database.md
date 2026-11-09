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
