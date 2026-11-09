# Cloudflare Security Audit 適用レビュー

2026-11-09。主担当は固定版の `.agents/skills/security-audit/SKILL.md` 全文とDATA-ISOLATION-AND-LIFECYCLE.md、CLIENT-SIDE.mdを読了した。

**run_status: incomplete**
**incomplete_reason: missing_os_enforced_sandbox**

Universal execution safetyは「Run target-controlled builds, tests ... only inside an OS-enforced sandbox」と規定し、ネットワーク遮断、空からのallowlist環境、読取専用target/toolchain、scratch限定書込、CPU/メモリ/process/時間等の強制制限をすべて要求する。この端末では全条件を強制できる隔離機構を構成していない。そのため正式6段階full auditは未完了。通常開発テストの結果をskill準拠sandboxの証明へ転用しない。

## 適用できたソースレビュー

|境界|確認ソース|制御|
|---|---|---|
|利用者→冊子/item|app.ts、brochures.ts|セッションuser_id、全item集合照合、所有者JOIN、revision。|
|画像→WebP→配信|app.ts|magic/MIME/容量/寸法、metadata除去、固定root＋UUID、配信時も本人JOIN。|
|除外→再生成→再採用|brochures.ts|selected切替でcomment/photoを保持。他人のitemを更新しない。|
|表示→PNG/コピー|App.tsx|現在draftの文字列描画、同一origin写真、外部アップロードなし。編集UI・旅全体アンケートはPNGから除外。|
|logout/ブラウザ保持|App.tsx、app.ts|セッション削除成功または既失効でclient状態解除。localStorageやService Workerを使用しない。|
|CSV→DB/復旧|importer.ts|元CSV読取のみ、必須/孤児/重複検証、parameter SQL、必要列だけ保持、DBと画像を同時復旧。|

この静的確認で新たな境界破りをconfirmedとは記録していない。固定コード、メール存在案内、style-src unsafe-inlineはデモ前提/防御補強の残存事項で、新たな確定脆弱性と断定しない。

## 安全な追試計画

専用OS隔離環境で、ダミー2利用者・最小fixtureを使い、ネットワーク遮断（必要なら隔離loopbackのみ）、allowlist環境、読取専用source/toolchain、専用scratchと資源上限を強制する。確認後にreconnaissance、coverage、独立verification、schema validatorまで全段階を実行する。現在はこの要件が未充足で、完全監査の完了保証はない。

通常の製品検証・独立レビュー・残存リスクは `docs/security.md` と `docs/verification.md` に別記する。

