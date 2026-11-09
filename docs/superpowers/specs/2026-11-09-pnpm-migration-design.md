# pnpm 移行設計

## 目的

npm から pnpm へ依存管理を移行し、移行時および通常の再導入時に現在より新しい依存バージョンが暗黙に入らない構成にする。

## ゴール

- 現在の `package-lock.json` で解決済みの直接依存バージョンを `package.json` に正確に固定する。
- pnpm 自体も `packageManager` と `engines.pnpm` で正確に固定する。
- `pnpm-lock.yaml` を唯一のアプリ依存 lockfile とし、導入手順を `pnpm install --frozen-lockfile --ignore-scripts` に統一する。
- `.npmrc` で新規依存の保存形式も exact にする。
- 依存build scriptを実行する場合も、現在の `esbuild@0.28.2` だけを許可し、将来版へ自動拡張しない。
- README、運用規則、関連技術資料の現在のコマンドを pnpm に合わせる。

## 非ゴール

- 依存パッケージのアップグレード、ダウングレード、追加、削除は行わない。
- アプリの UI、DB schema、migration、API 契約、生成規則は変更しない。
- 過去の検証記録にある npm 実行結果を、pnpm で実行したかのように書き換えない。
- 依存パッケージや pnpm 実体をリポジトリへ同梱しない。

## 制約

- Node.js は既存どおり `>=26 <27` とし、反映作業にはプロジェクト同梱の Node.js 26.13.0 を使う。
- 現在の解決済みバージョンを基準とし、`latest` タグや互換範囲による再解決を使わない。
- `Password*`、元CSV、ユーザー写真、ローカルDB、ツール実体を読取・変更・コミットしない。
- ユーザーから追加検証の明示依頼がないため、テスト、check、audit、E2E、独立レビューは実行しない。
- コード変更後の必須反映として build、3001 番アプリの限定再起動、最小限の HTTP 確認を行う。

## 検討した方法

1. **解決済みバージョンを exact 固定して pnpm へ移行（採用）**
   - 現在の成果物を保ったまま lockfile と実行コマンドだけを pnpm に移せる。
   - lockfile 再生成時にも直接依存の互換範囲から新しい版が入ることを防げる。
2. **`package.json` の範囲指定を残して lockfile だけ変換**
   - 差分は小さいが、lockfile を失った場合や再生成時に新しい互換版が選ばれるため要件を満たさない。
3. **依存物と pnpm 実体をリポジトリへ同梱**
   - ネットワークなしでも固定できるが、リポジトリ肥大化と更新管理の負担が大きく、ツール実体をコミットしない規則にも反する。

## 採用設計

`package-lock.json` の直接依存の解決結果を `package.json` の exact バージョンへ転記し、pnpm 11.25.0 を正確に宣言する。pnpm の import 機能で npm lockfile から `pnpm-lock.yaml` を作り、依存解決結果に意図しない更新がないことを差分と lockfile から確認した後、npm lockfile を削除する。`.npmrc` は `save-exact=true` と `prefer-frozen-lockfile=true` を設定し、再現手順では常に `--frozen-lockfile` を指定する。`pnpm-workspace.yaml` の `allowBuilds` は `esbuild@0.28.2: true` だけとし、依存build scriptの許可も版付きで固定する。

README と現行運用資料は pnpm コマンドへ更新する。過去の検証結果は履歴として保持し、今回実行した build と反映確認だけを新しい記録として追記する。
