# 指定スキルの導入・適用記録

2026-11-09。3種類ともプロジェクトローカルへ導入済み。最初は実Python不在で未導入だったが、ユーザーの追加承認により公式Pythonをプロジェクト内へ用意して解消した。

|指定|公式出所・固定SHA|配置|
|---|---|---|
|Superpowers|https://github.com/obra/superpowers / 22f0b463e7a5e579904dd6211a520321035526f7|.agents/skills/using-superpowers など公式15スキル|
|UI UX Pro Max|https://github.com/nextlevelbuilder/ui-ux-pro-max-skill / 4f2dbb67e64969a9a30ab00742f2d55d66ddec2b|.agents/skills/ui-ux-pro-max と公式同梱6関連スキル|
|Cloudflare Security Audit|https://github.com/cloudflare/security-audit-skill / c1c8a8c1471069fb0e188eeaff69b8e8db6564a8|.agents/skills/security-audit|

計23個のSKILL.md・286ファイル。ライセンス同梱。各ファイルSHA256は docs/skill-installation.json。新規チャットでは自動検出可能で、今回は主担当がファイルを読んで適用した。

## 取得・安全確認

標準skill-installerのSKILL.md、install-skill-from-github.py、github_utils.pyを全文確認。relative path、symlink、既存dest上書き拒否、ZIP展開境界を確認した。公式repoを .skill-sources にsparse/shallow取得してSHA固定し、対象Git treeにsymlinkがないことを確認。秘密情報らしき既存ファイルは取得・コピー・コミット対象外。

公式Python 3.13.12 Windows embeddableを .tools/python313 へ展開。公式公開SHA256 76f238f606250c87c6beac75dccd35ee99070a13490555936abb6cb64ecce3d0 と一致。
配布元: https://www.python.org/downloads/release/python-31312/
zip: https://www.python.org/ftp/python/3.13.12/python-3.13.12-embed-amd64.zip

標準helperを改変せずrunpy bridgeで実行。SuperpowersとSecurity Auditは .agents/skills へ、UIは一旦 .local/skill-staging へ取得。UI公式CLIのinit.ts/template.tsを読了し、未確認npxを使わず固定checkoutの planPlatformInstallActions → generatePlatformFiles(root,'codex',false,false) を実行。Codex以外、global、force、legacy削除は指定していない。公式referencesを同一SHAから補足コピーし、SKILL本文は改変せず、inventoryを作成・再照合した。

UI検索はstdlibのローカルCSV検索で外部通信なし。persistの書込は明示時だけ。Security Audit validatorはJSON確認用。Superpowersにはworktree削除等の手順も含むが実行していない。ユーザー指示とAGENTS.mdを例文より優先する。

標準helper初回実行で、共通helper配下に github_utils.cpython-313.pyc が1件生成された。以後は sys.dont_write_bytecode=True とし公開取得にGH tokenを渡さない。初回キャッシュの削除はポリシーで拒否され、そのキャッシュだけ残存。スキル本体のグローバル導入や既存SKILL.md変更はない。

残存場所は `%USERPROFILE%/.codex/skills/.system/skill-installer/scripts/__pycache__/github_utils.cpython-313.pyc`（1,457 bytes、2026-11-09 11:51:32）。公開helperのコンパイル済み補助キャッシュで、スキルのグローバル導入物やアプリデータではない。再削除やプロジェクトへのコピーを行わず、2026-11-09の最終確認で存在だけ確認した。環境変数表記とし、端末のアカウント名は資料に記載しない。

## 再現

通常利用は同梱 .agents/skills をそのまま使える。再取得するなら空の導入先と固定SHAのcheckoutを用意して以下を実行する。既存destは上書きせず停止する。

```powershell
.tools\python313\python.exe -B scripts/install-project-skills.py --installer C:\path\to\codex\skill-installer\scripts\install-skill-from-github.py
node --import tsx scripts/install-ui-skill.mjs
# 同一SHAのUI referencesと3ライセンスを配置後
node scripts/skill-inventory.mjs --write
node scripts/skill-inventory.mjs
```

詳細コマンドはscripts、helper自身のSHA・元パス・最終配置はJSONへ記録。ランタイム、checkout、staging、一時ファイルはGit対象外。vendorは .gitattributes で改行変換せずhashを維持する。

## 適用

- Superpowers: using-superpowers/Codex adaptation、systematic-debugging、verification-before-completionを読了。失敗ログ→原因→最小修正→再検証と完了前の新しい証拠を使用。承認済みデザインを再承認待ちに戻さない。
- UI UX Pro Max: Codex SKILL全文、quick-reference、pro-rulesを読了。keyboard focus modal / focus not obscured のux検索、form error recovery のReact検索を実行し対象・適合を確認。focus trap/Escape/復帰、濃色focus、scroll padding、写真再試行の重なりを修正。承認済み配色・ラスター素材を維持。ネイティブ専用/Dark modeの勧告はWeb要件に追加しない。
- Cloudflare: SKILL全文、DATA-ISOLATION-AND-LIFECYCLE.md、CLIENT-SIDE.mdを読了。所有者クエリ、写真の派生物、PNG、logout、browser保存、import/restoreをソース確認。OS強制sandbox条件を満たせないため正式full auditは incomplete / missing_os_enforced_sandbox。通常製品テストと監査証明を混同しない。docs/security-skill-review.md参照。
- imagegen: 内蔵標準モードと共有prompting規約を使用し、承認画面と7枚の架空スポット画像をラスター生成。アプリ実行時に外部AIを使わない。素材・プロンプトはdocs/assets.md。

最終統合時も3つの公式checkoutのHEADを上表のSHAと照合し、inventoryで286ファイル・23スキルが一致した。UIの追加検索 `orphan heading line balance --domain ux` はTypography / Heading Line Balanceを返し、Webの自然な折り返し・寸法確認という適用範囲を確認した。固定改行や改行禁止の追加はしていない。通常製品テストの合格数はスキル準拠完全監査の代用にしない。

