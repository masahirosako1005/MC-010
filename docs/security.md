# セキュリティ監査

監査日: 2026-11-09

対象はローカルデモ版のAPI、PostgreSQLアクセス、写真保存、React表示、PNG書き出し、主催者データ取り込み。独立コードレビューと製品テストに加え、公式Cloudflare Security Auditをプロジェクト内に導入してソース観点を再確認した。OS強制sandbox条件を満たさないため、正式full auditの状態はincomplete。詳細は `docs/security-skill-review.md`。

**後続の共有URL追加は未監査・未テスト。** 以下の過去の監査/テスト結果は共有APIの合格を意味しない。現在の仕様では、利用者が共有URLを発行した場合だけ、掲載中/選択した思い出の写真・コメントをURL所持者へ配信する。生URLは推測困難な乱数で、ログや町側一覧へ出さない。通常の写真APIは認証必須、共有写真APIは公開状態と現在の対象itemを照合する。非所有者にはクーポン情報を返さず、表示/利用はセッション本人の既存APIで確認する。公開停止は以後の取得を止めるが、閲覧者が取得済みのデータは回収できない。サーバーのローカル限定は維持する。[現行仕様](spec.md)と[実施範囲](verification.md)を参照。

## 前提と脅威モデル

- 本アプリは `127.0.0.1` で動かすローカルデモであり、LAN・インターネット・クラウドへ公開しない。
- 固定コード `1111` は本人確認にならない。デモ利用者の切替だけに使う。
- 保護対象は利用者ごとの訪問履歴、コメント、写真、パンフレット、および主催者CSV内の識別情報である。
- 重点脅威はIDOR、SQL injection、stored XSS、CSRF、画像偽装、巨大画像、path traversal、生成競合、秘密情報の誤コミットである。

## 全体監査

| 領域 | 確認箇所 | 結果 | 根拠・残存リスク |
|---|---|---|---|
| 公開範囲 | `src/server/index.ts`, API middleware | 対応済み | サーバーは `127.0.0.1` bind。Hostもlocalhost系に限定する。ポート転送やリバースプロキシ越しの公開は対象外。 |
| 固定コード | login schema, `POST /api/login` | 対応済み | ASCII 4桁へ限定後に `timingSafeEqual` で `1111` と比較。全角4文字によるバイト長例外は修正済み。固定コード自体は公開環境で使用不可。 |
| ログイン試行 | `POST /api/login` | 対応済み | 1IPあたり30回/分のメモリ内制限。プロセス再起動で消えるため、ローカルデモ用の防御である。 |
| セッション | `sessions`, cookie | 対応済み | 32byte乱数を発行しDBにはSHA-256だけを保存。`HttpOnly`, `SameSite=Strict`, 12時間。ローカルHTTP前提のため `Secure=false`。 |
| CSRF | mutation middleware | 対応済み | 状態変更は許可Originと `X-Requested-With: kondo` を両方要求。APIは `Cache-Control: no-store`。 |
| SQL injection | `src/server/*.ts` | 対応済み | 利用者入力は `$1` 等でパラメータ化し、SQL構文へ連結しない。 |
| XSS | React, CSP | 対応済み | コメント等はReact text nodeで描画し、`dangerouslySetInnerHTML` なし。CSPと `nosniff` を設定。`style-src 'unsafe-inline'` は残存リスク。 |
| 入力制限 | Zod, JSON, multipart | 対応済み | strict object、enum、UUID、件数、200字。JSON 512KB、写真5MB・1ファイル。UIとAPIの5MB表示は一致。 |
| エラー情報 | error middleware | 対応済み | stack、SQL、保存パス、入力本文を応答・ログへ出さない。予期しない失敗は定型503。 |
| HTTPヘッダー | global middleware | 対応済み | CSP、frame拒否、referrer拒否、permissions policy、`nosniff`。 |
| 秘密・個人情報 | `.gitignore`, importer | 対応済み | `.env`, CSV, uploads, `Password*` を除外。主催者IDはハッシュ由来IDへ変換。メール、コード、セッショントークンをログ出力しない。 |
| 保存失敗 | `src/client/App.tsx` | 対応済み | 失敗時にdraftを置換せずerror状態と再試行を維持。保存中に追加した編集もサーバー応答で巻き戻さない。 |
| PNG | `html-to-image` | 対応済み | ブラウザ内でdata URLを作り端末保存。外部アップロードなし。非常に大きい画像でのブラウザメモリ不足は残存リスク。 |
| 依存関係 | `package.json`, lockfile | 対応済み | `csv-parse 7.0.3`, `multer 2.5.0`, `zod 4.6.7` へ更新後、Node 26環境で開発依存を含む `npm audit --json` 0件を確認。 |

## 重点監査

### アカウント分離とIDOR

- user IDはbodyやqueryから受け取らず、ハッシュ済みセッショントークンから決定する。
- パンフレット取得・保存・再生成は `WHERE user_id=$1` で現在利用者へ限定する。
- 保存時は現在パンフレットの全item ID集合とdraftを照合し、他パンフレットのitem混入、重複、欠落を拒否する。
- 写真追加・削除・取得は `brochure_items JOIN brochures` と `b.user_id=$2` で所有者を再確認する。
- 他人のitem/photoは存在の詳細を返さず404とする。

実PostgreSQL統合テストで別利用者のSavePayload混入、写真追加・取得、revision競合を確認。写真削除の所有者条件と不正順序はソース・バリデーションでも確認。未検証範囲へ合格を外挿しない。

### 生成競合とデータ完全性

- 初回生成は利用者行を `FOR UPDATE` でロックし、`brochures.user_id` のUNIQUE制約を二重防御にする。
- 保存・再生成はパンフレットをロックし、revision不一致を409で拒否する。
- 再生成は `selected`, `sort_order`, `reason` だけを更新し、外れたスポットの行・コメント・写真を削除しない。
- 写真差し替えは新ファイル作成後にDB transactionで参照を交換し、DB失敗時は新ファイルを削除する。

残存リスク: 古い写真の削除失敗は孤児ファイルになり得る。定期的な孤児整理は未実装。DB参照との照合・バックアップ後に運用者が整理し、uploads全体を安易に削除しない。

### 画像形式・MIME・サイズ・保存先

- JPEG/PNG/WebPのみ許可し、宣言MIMEとmagic bytesの一致を確認する。SVG/XML/HTMLは拒否する。
- Sharpで実デコードし、静止画1ページ、6000px以下、2400万画素以下、入力5MB以下に制限する。
- 2000px以内のWebPへ再エンコードするため、EXIF/GPSと能動コンテンツを引き継がない。
- 保存名はサーバー生成UUID + `.webp` のみ。正規表現と `path.resolve` 後の親ディレクトリ照合でpath traversalを防ぐ。
- uploadsを静的公開せず、認証・所有権確認済みAPIだけで配信する。

実ファイル統合テストでMIME偽装、SVG、5MB超、巨大寸法、通常画像の差し替え・削除を確認。破損画像も実デコードで拒否。高負荷の差し替え競合・資源枯渇の正式隔離試験は未実施。

### 入力検証・SQL injection・XSS

- emailはtrim・小文字化・email形式・254字、codeはASCII 4桁、選択肢はenum、IDはUUID、配列数と順序値を検証する。
- コメントはJavaScriptでUnicodeコードポイント200字以内、DBでも `char_length(comment)<=200`。
- HTML風文字列は保存可能だが、Reactで文字列として表示し実行しない。共有コピーもプレーンテキストである。
- パラメータ化SQLを全API・取り込み処理で使用する。

残存リスク: メール不存在とコード不正を404/401で分けるためメール存在確認が可能。デモの案内性を優先した仕様上のリスクであり、実サービスでは統一エラーにする。

### 個人情報と固定コード

- fixtureは `example.test` を使用し、実在メールを含めない。
- CSVはGit除外し、主催者IDをそのままDB外部IDへ保存せずハッシュ化する。
- 画像再エンコードで位置情報を除去する。
- UIとREADMEで固定コード・ローカルデモ専用を明示する。

残存リスク: 固定コードは認証強度を提供しない。実データ投入状態でLAN公開、ポート転送、クラウド配備をしてはならない。

## 検証状況

| 検証 | 状態 | 内容 |
|---|---|---|
| generator単体 | 合格 | 推薦、再訪、rotation、一人用紹介文、履歴なし生成拒否を検証。 |
| validation単体 | 合格 | enum、strict入力、UUID、Unicode 200/201字、再生成payloadを検証。 |
| Node/DB | 合格 | 公式checksum確認済みNode.js 26.13.0、PostgreSQL 17.11で実行環境を構築。 |
| 依存監査 | 合格 | 更新後 `npm audit --json` 0件（開発依存を含む）。 |
| API統合 | 合格 | 実PostgreSQLで10件、単体/取り込みを合わせ46件合格。全角code・正常PNG fixtureを修正して確定。 |
| ブラウザ中心フロー | 合格 | PC5件・スマホ5件、計10件。demo01の初回生成・復元、保存/写真503からの保持・再試行、候補追加除外・置換・順序、200字、再読込、再生成、コピー、両PNG、再ログインを実ブラウザで確認。 |
| PC/スマホ・アクセシビリティ | 一部未検証 | PC/スマホエミュレーションの中心フローと小画面/横向き/動き軽減/キーボードを自動検証。スマホ実機、スクリーンリーダー、200%ズームは未検証。 |

## 最終再監査手順

1. `TEST_DATABASE_URL` に破棄可能なPostgreSQL DBを指定し、Node.js 26と固定pnpmで `pnpm test` を実行する。
2. 同一利用者の並列ensureでパンフレットが1件だけであることを確認する。
3. 2利用者間でitem ID、photo ID、SavePayloadを差し替え、404/400となりデータが変わらないことを確認する。
4. 正常写真の追加・差し替え・削除・再取得、およびMIME偽装、SVG、5MB超、巨大画像を確認する。
5. revision競合、不正な重複順序、201字コメントを拒否し、画面入力が残ることを確認する。
6. PNG生成中のNetworkパネルで外部送信がないことを確認する。
7. スマホ実機、キーボード、スクリーンリーダー、動き軽減、200%ズームを確認し、未検証欄を更新する。

上記は通常開発のソースレビュー・製品検証手順。Cloudflare正式監査として実行する場合は、先に同スキルのOS強制sandbox条件を満たす必要がある。この端末での完了済み範囲・未実施範囲は [最終検証記録](verification.md) と [Cloudflare適用記録](security-skill-review.md) を参照。
