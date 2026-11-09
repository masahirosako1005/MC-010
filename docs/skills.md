# 指定スキルの確認記録

2026-11-09。最初にCodex標準 skill-installer の `SKILL.md` を読了。プロジェクトローカルの `--dest` を指定できるが、helperは実Pythonを必要とする。端末のpython/python3はWindowsAppsエイリアスのみで、実Pythonは利用できなかった。共通領域へのインストールはしていない。

|指定|確認した正式配布元|導入結果・代替|
|---|---|---|
|Superpowers|https://github.com/obra/superpowers|現行Codex手順はマーケットプレイス管理で、プロジェクト限定の正式手順を満たせない。標準helperの個別skill取得はPython不在で未実施。要件→設計→小分け実装→テスト→独立レビューを代替手法として実行。|
|UI UX Pro Max|https://github.com/nextlevelbuilder/ui-ux-pro-max-skill|公式CLIはプロジェクト内 `.agents/skills` に配置できるが、検索はPython必須。未レビューのnpxコードを実行せず未導入。承認画像、CSSトークン、レスポンシブ/キーボード/状態検証を使用。|
|Cloudflare Security Audit|https://github.com/cloudflare/security-audit-skill|候補として公式READMEを確認。完全監査はOS強制sandbox等を必要とする。この環境で正式完全監査を実施したとは扱わず、独立担当のソースレビュー＋自動境界テストを実施。|

`imagegen` は内蔵ツールの標準モードを使用。SKILL.mdとprompting/sample-promptsを読了し、採用画面と7枚の架空スポット画像をラスターで生成。生成時の秘密APIキーは不要で、アプリ実行時の外部AI依存はない。画像はすべてプロジェクトへコピーし、元画像を保持している。

これらの未導入はアプリ実装の停止条件にせず、完了済みと捏造しない。将来導入する際は実Pythonを用意し、固定した公式repo/pathとプロジェクト内destを指定し、読了後に利用する。

