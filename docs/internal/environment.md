# 開発端末の環境記録（内部向け）

2026-11-09の検証時の記録を `technology.md` から分離したもの。現在の稼働設定や今回の検証結果を示すものではない。一般公開資料には同梱せず、開発・運用担当者が再現のために参照する。秘密の設定値・接続資格情報・個人情報は追記しない。

- Windows x64、Node.js 26.13.0、pnpm 11.25.0、PostgreSQL 17.11。
- PlaywrightのPC/スマホともMicrosoft Edge 157.0.4341.42のheadless実行。スマホはiPhone 13相当390×844のエミュレーションで、実機Safariではない。
- PostgreSQLは `.tools/pgsql` の配布バイナリ。専用clusterは `.local/pgdata`、127.0.0.1:55432。Windowsサービス登録なし。
- DB補助スクリプトの初期化・起動・状態確認・通常停止は、別の空clusterを55433番へ作って確認した記録がある。Windows PowerShell 5.1の文字コード差を避けるためスクリプト本文はASCII。
- 通常デモDBは `kondo_anatato`。基礎版の最終再現には別の空DB `kondo_final_verify_20261109` と `.local/final-verify-uploads`、アプリ3003番を使用した。既存の編集は消していない。
- システムNodeの置換やグローバルスキル導入は行わず、各コマンドのPATHだけへローカルNodeを追加した。

後続の検証は別の専用DB・保存先・ポートを使用している。実行の対象版と分離方法は [検証履歴](../verification.md) および [しおり・共有・クーポンの検証](../booklet-verification.md) を参照する。この記録のDBを現在利用中のDBとみなして操作しない。

配布元・アーカイブSHA256は [技術資料](../technology.md)、資料の公開範囲は [資料案内](../README.md) を参照する。
