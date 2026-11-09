---
name: project-cache-clear
description: Use when the 今度はあなたと project needs a manual public-content cache clear (公開キャッシュ削除・更新の即時反映), including after a CSV import or direct DB update. Not for browser/CDN caches, data deletion, application deployment, or routine automatic invalidation.
---

# 公開キャッシュの手動クリア

このプロジェクトの公開本文・共有写真のサーバーメモリー内キャッシュを、対象アプリ1回の再起動で空にする。通常は最大1日・合計32MiBで、アプリからの保存・写真変更・公開停止などでは自動クリアされる。CLI取込やDB直接更新の即時反映、古い公開内容への運用対処に使う。

現在、手動クリア専用APIやCLIはない。キャッシュはプロセス内にあるため、別のNodeプロセスで`PublicContentCache.clear()`を呼んでも稼働アプリには届かない。DB・写真ファイル・ブラウザ保存領域を削除しても、このキャッシュのクリアにはならない。

## 依頼の範囲

- 「公開キャッシュをクリアして」という実行依頼は、同定済みアプリを短時間停止して1回再起動する運用処理として進める。既に依頼された処理を再承認待ちに戻さない。
- スキルの作成・説明だけの依頼では、アプリ停止やクリアを実行しない。再起動禁止が明示されている場合は、現実装での手動クリアには再起動が必要と説明し、勝手にAPIを追加しない。
- 対象はこのプロジェクトの公開キャッシュ全体。URL別の消去や別環境へは拡張しない。

## 事前確認

1. スキルを置いたプロジェクトのGitルートを絶対パスで特定し、[AGENTS.md](../../../AGENTS.md)と`git status --short`を参照する。未保存の編集内容がある場合があるため、短時間の再起動を行うことを先に伝える。
2. [キャッシュ実装](../../../src/server/public-content-cache.ts)、[アプリへの組込み](../../../src/server/app.ts)、[起動処理](../../../src/server/index.ts)、[現在の仕様](../../../docs/spec.md)を読み、キャッシュが依然としてプロセスメモリーだけにあることを確認する。実装が変わっていれば、古い再起動手順をそのまま実行しない。
3. Windowsでは3001番のLISTEN所有PIDを調べ、プロセスの実行ファイル・server entrypoint・起動時の作業場所・既存の起動引数を照合する。ポート番号や`node.exe`という名前だけで決めない。コマンドラインや環境変数全体は出力せず、PIDと照合結果だけを扱う。
4. この環境の既知の構成は、プロジェクト内`.tools/node-v26.13.0-win-x64/node.exe`、`--env-file-if-exists=.env`、`dist/node/server/index.js`、作業場所はプロジェクトルート。相対entrypointの場合は、該当PIDの起動記録にあるWorkingDirectoryも照合する。確定できない場合は対象情報を求め、推測で停止しない。
5. 停止前に、再利用するNode実体・既存のビルド済みentrypoint・既知の起動方法が揃っていることを確認する。ビルド、依存取得、migration、接続先切替は行わない。別作業中のソースをビルドして意図しない反映をしない。

`Password*`、`.env*`や認証ファイルの内容は開かない。既存の起動経路に環境ファイルを読み込ませ、秘密を引数や報告へ転記しない。独自の接続設定・環境変数・ログ出力先を使っている起動方法を既定値へ置き換えない。再現に必要な設定が不明なら、停止前に解決する。

## クリアの実行

同定したPIDだけを停止し、確認済みのNodeと作業場所・起動設定でHidden再起動する。DBや別アプリを停止しない。`taskkill /IM node.exe`やプロセス名による一括停止、DB再起動、写真フォルダー削除、キャッシュを空にするためだけのダミー保存は使わない。

既知の構成に一致した場合のPowerShell例。変数は事前確認で確定した絶対パスとPIDを使う。この例だけを切り出して同定前に実行しない。

```powershell
$ErrorActionPreference = 'Stop'
$cacheEntryPath = Join-Path $cacheProjectRoot 'dist/node/server/index.js'
# $cacheProjectRoot / $cacheNodePath / $cacheAppPid は事前に照合済み。
if (-not (Test-Path -LiteralPath $cacheNodePath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $cacheEntryPath -PathType Leaf)) {
  throw '再起動に必要なファイルがないため停止しません。'
}
# 停止直前に3001番の所有PIDとプロセス実体を再照合する。
# PIDが変わった場合は事前確認へ戻り、新しいプロセスを推測で停止しない。
Stop-Process -Id $cacheAppPid -ErrorAction Stop
$cacheRestartedApp = Start-Process -FilePath $cacheNodePath `
  -ArgumentList @('--env-file-if-exists=.env', ('"' + $cacheEntryPath + '"')) `
  -WorkingDirectory $cacheProjectRoot -WindowStyle Hidden -PassThru
```

再起動は1回に限定する。起動に失敗した場合は連続して再試行したり、別のポート・DB・起動引数に切り替えたりせず、現在の停止/起動状態と不足情報を報告する。

## 終了条件と報告

- 新PIDが確認済みNode/entrypointのプロセスで、127.0.0.1:3001を待ち受けていること。別PIDがポートを取得していたら、そのプロセスを停止せず不一致を報告する。
- `GET http://127.0.0.1:3001/api/health`と`GET http://127.0.0.1:3001/`を必要最小限だけ参照し、200とアプリの識別を確認する。起動待ちは最大5回・1秒間隔・HTTP timeout 3秒まで。出力はstatus、healthの成否、アプリ識別の成否に限定し、HTML本文や応答全体を表示しない。
- 新規プロセスには旧プロセスのメモリーが引き継がれないことを根拠に、公開キャッシュをクリアしたと報告する。専用の件数取得APIはないため「キャッシュ0件を計測した」「負荷改善を検証した」とは記載しない。起動直後に閲覧があれば再びキャッシュされる。
- 実行日時（Asia/Tokyo）、旧/新PID、短時間再起動によるクリア、HTTP確認結果、残る問題を簡潔に報告する。起動失敗やhealth失敗はクリア/復旧完了として扱わない。
- 公開URLや本文・写真を確認目的で取得せず、ログイン・共有URL発行・表示回数の加算も行わない。テスト・レビュー・監査・ベンチマークは明示依頼がある場合だけ。自動実行・定期スケジュールは作らない。

依頼例: 「project-cache-clearで公開キャッシュをクリアして」
