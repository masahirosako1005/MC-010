# @@REPORT_TITLE@@

> 総合状態: **@@OVERALL_STATUS_LABEL@@**  
> `complete/incomplete`は監査工程の完了状態であり、脆弱性の有無を表しません。@@PREFLIGHT_NOTICE@@

@@REPORT_SUMMARY@@

## 実行情報

|項目|値|
|---|---|
|実行日時|@@GENERATED_AT@@|
|リポジトリ|@@REPOSITORY@@|
|Source ref|@@SOURCE_REF@@|
|Worktree|@@DIRTY_STATE@@|
|プロファイル|@@PROFILE@@|
|実行モード|@@EXECUTION_MODE@@|
|許可された境界|@@AUTHORIZATION_BOUNDARY@@|
|Incomplete reason|@@INCOMPLETE_REASON@@|

## 判定サマリー

|OK|NG|要確認|未実施|対象外|
|---:|---:|---:|---:|---:|
|@@OK_COUNT@@|@@NG_COUNT@@|@@NEEDS_VALIDATION_COUNT@@|@@NOT_RUN_COUNT@@|@@OUT_OF_SCOPE_COUNT@@|

## コンポーネント状態

|コンポーネント|要求|実行|状態|対象範囲|証拠|未検証・gap|
|---|---|---|---|---|---|---|
@@COMPONENT_ROWS_MD@@

## フレームワーク対応

|フレームワーク／分類|対象項目|状態|根拠・制約|
|---|---|---|---|
@@FRAMEWORK_ROWS_MD@@

## 監査項目

|ID|Frameworks|区分|監査対象|監査方法|実施|判定|判定理由|証拠|未検証・gap|
|---|---|---|---|---|---|---|---|---|---|
@@AUDIT_ITEM_ROWS_MD@@

## IPA 11項目対応表

|IPA ID|分類|判定|所見ID|証拠|判定理由|
|---|---|---|---|---|---|
@@IPA_MAPPING_ROWS_MD@@

## NG: 確定した問題

@@CONFIRMED_FINDINGS_MD@@

## 要確認: 候補と追加確認

@@NEEDS_VALIDATION_MD@@

## 制約・対象外・未実施

@@LIMITATIONS_MD@@

## 成果物と再現情報

@@ARTIFACTS_MD@@

## 出所

@@PROVENANCE_MD@@

生成元: `web-security-audit` / @@TOOL_VERSIONS@@

