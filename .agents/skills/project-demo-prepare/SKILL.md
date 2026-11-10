---
name: project-demo-prepare
description: Use when the 今度はあなたと project needs local demo preparation for demo@example.test, including 来訪履歴の紐づけ, しおり作成履歴のクリア, or restarting the first-creation demo. Not for other accounts, organizer data imports, or a full database reset.
---

# 通常デモを初回作成の状態へ戻す

`demo@example.test` の既存デモ用来訪履歴を確保し、この利用者のしおりを未作成へ戻す。対象はローカルの `fixture:demo` だけ。来訪履歴は架空のデモ実績であり、提供CSVの利用者へメールを付け替えたり、実来訪として扱ったりしない。

## 依頼と変更範囲

- 「このスキルでデモ準備して」は、以下の対象確認、本人のしおり初期化、短時間のアプリ停止・Hidden再起動までを含む。件数と影響を先に伝え、既に依頼された処理を再承認待ちに戻さない。
- スキルの作成・説明だけの依頼ではDB接続・停止・初期化を実行しない。別アカウント、別環境への拡張もしない。
- 「しおり作成履歴をクリア」は `brochures` の本人の1件と関連する編集・写真参照・共有履歴を削除する意味。`regeneration_count=0` だけでは初回画面に戻らない。

| 対象 | 処理 |
|---|---|
| `users` | `fixture:demo` を確認。未作成ならこのデモ利用者1件だけ作成。 |
| `visits` | 下記のseedと同じ2件を不足分だけ追加。既存履歴は保持。 |
| `brochures` と本人の子レコード | 本人のしおり・条件・コメント・写真参照・共有URL・共有表示/コピー履歴を削除。旧共有URLは利用不可になる。 |
| `sessions` | 本人のセッションだけ削除し、古い編集画面からの保存を防ぐ。 |
| その他 | 他利用者、アンケート、クーポン利用/コード、町管理データ、取込履歴、スポット、写真ファイルは保持。 |

## 対象を確定する

1. スキルを置いたGitルートを特定し、[AGENTS.md](../../../AGENTS.md)、`git status --short`、[仕様](../../../docs/spec.md)、[デザイン](../../../docs/design.md)、[採用画像の対応](../../../docs/assets.md)、[取込資料](../../../docs/data-import.md)を参照する。既存変更・削除を維持する。
2. [seed](../../../src/server/db-cli.ts)、[ID生成](../../../src/server/catalog.ts)、[ログイン照合](../../../src/server/app.ts)、[冊子処理](../../../src/server/brochures.ts)、[migration](../../../db/migrations)を読み、下記のID・依存関係・初回判定と現実装が一致することを確認する。schema/APIは変更しない。
3. [project-cache-clearの事前確認と起動手順](../project-cache-clear/SKILL.md)に従い、3001番の所有PID、Node実体、entrypoint、WorkingDirectory、既存起動設定を照合する。停止・再起動に必要な情報が揃うまで停止しない。ソース内の既定DB名を稼働先と決めつけない。
4. 稼働アプリと同じ既存の認証経路・接続設定を使い、Node 26と既存の `pg` で対象DBへ接続する。`Password*`、`.env*`、認証ファイルを開かず、環境ファイルは既存の起動経路に読み込ませる。接続URL・パスワード・環境変数全体・コマンドライン全体を表示しない。接続先を同定できない場合だけ不足情報を求める。
5. `external_id`、固定デモメール、別名の照合はパラメータ化したSQLで行う。`users.email` と `auth_aliases.email` のUNIONでログイン先が一意になる必要がある。`demo@example.test` が別の利用者を指す、`fixture:demo` が `source='fixture' / account_role='visitor'` でない、既存メールが別値、IDがseedと異なる場合は変更せず停止する。実メールや表示名は取得・出力しない。
6. 本人の来訪件数、しおりと子レコード件数、セッション件数だけを集計し、削除対象を伝える。`SELECT *`、コメント、回答、トークン、共有URL、写真キーの出力は使わない。しおりの編集・公開履歴は失われること、写真実体は残ることを明記する。

## 来訪履歴の紐づけ

独自の履歴を作らず、現在の `seed()` が `demo` に用意する2件を再利用する。IDは `stableId` の現実装から算出する。

| 用途 | seedと一致させる値 |
|---|---|
| 利用者 | `id=stableId('fixture-user:demo')`、`external_id='fixture:demo'`、`email='demo@example.test'`、`display_name='デモ利用者'`、`source='fixture'`、`account_role='visitor'` |
| 月花の風車丘 | `spot_id=stableId('sample-spot-1')`、`id=stableId('fixture-visit:demo:0')`、`source_key='fixture:demo:0'` |
| 灯雲の石畳通り | `spot_id=stableId('sample-spot-4')`、`id=stableId('fixture-visit:demo:3')`、`source_key='fixture:demo:3'` |
| 両履歴の値 | `visited_at='2026-05-03T10:00:00+09:00'`、`stamp=true`、`user_id=上記利用者ID` |

両スポットのIDと `external_id` が一致し、初回作成に必要な公開中候補が存在することを確認する。不足時は初期化せず終了し、勝手にmigration・全体seed・CSV再取込・公開状態の変更をしない。

既存の訪問IDまたは `source_key` が他利用者・別スポット・異なる日時/スタンプを指す場合は衝突として停止する。完全一致する行は再利用し、不足行だけINSERTする。`ON CONFLICT DO UPDATE` で履歴を移し替えない。2件以外の既存来訪履歴やアンケートも書き換えない。

## 初期化を実行する

読み取り準備が終わってから、同定済みの本プロジェクトのアプリだけを停止し、処理中の書き込みと取込CLI等の別の書き込み元がないことを確認する。DBサービスと別アプリを停止しない。停止中は本手順以外からデモ操作しない。停止を禁止されている場合は、競合とキャッシュ反映を確実に扱えないため書き込み前に終了する。

単一 `pg.PoolClient` の単一transactionで以下を行う。SQL値は `$1` 等へbindし、入力からSQLや識別子を組み立てない。

1. `BEGIN`、`SET LOCAL lock_timeout='5s'`、`SET LOCAL statement_timeout='10s'`。`pg_advisory_xact_lock(6821452)` を取得し、カタログ変更・冊子生成と直列化する。
2. 対象・メール/別名・スポット・訪問キーの衝突確認をtransaction内でも再実行する。利用者が未作成なら上記の固定fixture1件だけINSERTする。既存利用者は更新しない。利用者行を `FOR UPDATE` でロックする。
3. 上記の来訪履歴を不足分だけ追加し、全履歴の所有者と値が想定どおりであることを確認する。別名の新設や他利用者のメール変更は不要。
4. `SELECT id FROM brochures WHERE user_id=$1 FOR UPDATE` で対象の冊子IDを取得する。0件なら冊子削除を省略する。本人の共有行も `FOR UPDATE` でロックしてから、次の順でDELETEする。

| 順番 | 削除対象と絞り込み |
|---|---|
| 1 | `share_page_views`、`share_url_copies`：`share_id IN (SELECT id FROM brochure_shares WHERE brochure_id=$1)` |
| 2 | `brochure_shares`：`brochure_id=$1` |
| 3 | `item_photos`：`item_id IN (SELECT id FROM brochure_items WHERE brochure_id=$1)` |
| 4 | `brochure_items`：`brochure_id=$1` |
| 5 | `brochures`：`id=$1 AND user_id=$2` |

5. `sessions WHERE user_id=$1` を削除する。上表の `$1` は冊子ID、セッション削除の `$1` は利用者ID。各queryへ適切な値を個別bindする。
6. COMMIT前に、ログイン先が対象1人、seed訪問2件が本人に存在、本人の冊子・関連行・セッションが0件であることを集計で確認する。削除前に保持した冊子ID/共有ID/item IDも利用し、子行の残存を調べる。想定外の行数・所有者・外部キー関係やSQL失敗があれば `ROLLBACK` し、全体を未実施として報告する。
7. 終了条件が満たされた場合だけ `COMMIT`。既に未作成なら削除0件を正常として扱う。COMMITの通信結果が不明なら再実行せず、再接続して集計から確定/未確定を報告する。DBエラー全文は出力せず、処理段階・SQLSTATE・rollback/確定状態だけを報告する。

写真はDB参照だけを削除する。`UPLOAD_DIR` の実体は復旧用に保持し、孤立写真の掃除やバックアップ作成・復元はこの操作に追加しない。物理名の一覧も出力しない。必要なバックアップが別途指定されていれば、削除前にその依頼を処理する。

## 復帰と終了条件

- DB処理の成功・失敗にかかわらず、停止したアプリを元と同じビルド済みentrypoint・作業場所・設定で1回Hidden起動する。アプリコードを変更しないためビルド・依存取得は不要。別ポート・別DBへの切替や連続再起動はしない。
- 新PIDと3001番の所有者を照合し、`GET /api/health` と `GET /` の必要最小限のHTTP参照で配信を確認する。詳細は `project-cache-clear` の終了条件を使う。再起動で旧プロセスの公開キャッシュを破棄する。
- 初期化後に自動ログイン・しおり生成・共有URL発行・公開URL閲覧をしない。ログイン/初回生成のテストは別途明示依頼がある場合だけ。ブラウザの古い編集タブは再読み込みし、`demo@example.test` / ローカルデモコード `1111` から開始するよう案内する。
- 実行日時（Asia/Tokyo）、デモfixtureの来訪件数（既存/追加/終了時）、削除した冊子と子行・セッションの件数、DB確定状態、アプリ復帰とHTTP結果、写真実体の保持を簡潔に報告する。DB成功と再起動失敗は分け、復帰できていない場合は全体完了と記載しない。
- これは運用処理の終了確認。validator・inventory照合・check・audit・単体/E2Eテスト・独立レビューは明示依頼がある場合だけ実行する。

依頼例: 「project-demo-prepareでdemo@example.testのデモ準備をして。来訪履歴を紐づけ、しおり作成履歴をクリアして」
