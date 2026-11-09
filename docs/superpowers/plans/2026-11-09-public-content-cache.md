# Public Content Cache Implementation Plan

> **For agentic workers:** writing-plans / executing-plansで現在のセッション内に実装する。AGENTS.mdの明示指示を優先し、追加テスト・レビュー・worktree作成を行わず、既存作業場所でbuildとHidden再起動を実施する。

**Goal:** 公開URLの非所有者向け本文と共有写真だけを容量制限付きで再利用する。

2026-11-09追記: 後続の明示指示により、有効期間を最大1日（24時間）へ延長。容量上限と状態変更API応答時のクリアを維持する。CLI/DB直接更新の即時反映にはアプリ再起動が必要。追加テスト・レビューは実行せず、buildとHidden再起動で反映する。

**Architecture:** アプリごとにBuffer専用の期限・容量・件数制限付きLRUキャッシュを持つ。共有の認可を毎回実行してから参照し、作者本文は迂回する。状態変更のJSON応答で破棄し、表示計測は除外する。

**Tech Stack:** TypeScript / Node 26 / Express 5、追加依存なし。

**Spec:** docs/superpowers/specs/2026-11-09-public-content-cache-design.md

## Tasks

- [x] `tests/public-content-cache.test.ts`へ期限、LRU、容量、巨大値、同時読込、失敗再試行、失効競合の回帰ケースを記述する。実行は依頼がないため行わない。
- [x] `src/server/public-content-cache.ts`へBufferキャッシュと状態変更応答による失効middlewareを追加する。`app.ts`でアプリ専用インスタンスを共有routerへ渡す。
- [x] `sharing.ts`で非所有者本文だけをキャッシュし、作者本文は迂回。写真は毎回公開状態と掲載範囲を認可してからファイルバイトを再利用する。
- [x] 共有APIの回帰ケースを追記し、spec/design/security/READMEへ対象・限界を記録する。追加テスト・レビューは未実施と明記する。
- [x] Node 26 / pnpm 11.25.0でbuild。3001番の対象を再同定し、そのアプリだけHidden再起動。トップ/healthのHTTP応答を確認しverificationへ記録する。
- [x] 自分の変更ファイルだけをステージし、秘密・元CSV・写真・DB・ツール・他の作業の混入がないことを確認して小さなコミットを作る。

反映根拠: Node 26.13.0 / pnpm 11.25.0のbuildが終了コード0。3001番の既存アプリPID 33312を同定してHidden PID 28036へ再起動し、トップ/healthは200。詳細はdocs/verification.md。追加テスト・レビュー・負荷測定は未実施。並行中の管理詳細画面と監査文書は今回のコミット対象外。

## Future verification focus (not executed)

所有者→匿名、匿名→所有者の順序でクーポン表示を分離すること。保存・写真変更・除外・管理スポット更新・公開停止で温まったキャッシュが失効すること。非掲載/停止写真をキャッシュから配信しないこと。閲覧記録が本文キャッシュを破棄せず、通常どおり重複排除して加算されること。更新前から進行していた読込が失効後のキャッシュを汚染しないこと。
