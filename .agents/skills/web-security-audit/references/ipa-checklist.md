# IPA Checklist and Supplemental Checks

## Basis and Interpretation

The normative checklist is based on IPA's 「安全なウェブサイトの作り方」 vulnerability categories: <https://www.ipa.go.jp/security/vuln/websecurity/about.html>.

`IPA-1.1` through `IPA-1.11` are fixed coverage rows and must always appear in the report. `SUP-*` rows are project-risk supplements inspired by modern browser isolation and operational review; they are not represented as additional official IPA categories.

For every row, trace source from an untrusted input or action through parsing/normalization to the enforcement point and security-relevant sink. Record exact file/line or configuration evidence without copying secrets or real user data.

## Official 11 Categories

| ID | IPA category | Source questions | Evidence and decision cautions |
|---|---|---|---|
| `IPA-1.1` | SQLインジェクション | Are all database values parameterized? Are identifiers/order clauses allowlisted? Do raw query helpers, migrations, admin/report filters, and import paths preserve parameters? | `OK` needs representative source-to-query traces for each query mechanism. String assembly reaching SQL is `NG` only when attacker-controlled input can affect SQL structure; otherwise record the exact gap. |
| `IPA-1.2` | OSコマンド・インジェクション | Can request, file, database, or job values reach `exec`, shell scripts, process launchers, archive tools, converters, or package commands? Are executable and arguments fixed or allowlisted, with shell parsing disabled? | Absence of process-launch surfaces may be `対象外` with search and architecture evidence. A process API alone is not `NG`; establish control of command or arguments and the crossed boundary. |
| `IPA-1.3` | パス名パラメータの未チェック／ディレクトリ・トラバーサル | How are upload/download/image/template/export paths derived? Are decoded paths normalized, confined to an owned root, and protected from absolute paths, traversal, alternate separators, symlinks, and device names? | `OK` requires a confinement trace, not only extension checks. Do not inspect user files; review path construction and storage APIs with dummy examples. |
| `IPA-1.4` | セッション管理の不備 | How are sessions created, rotated, expired, revoked, and bound to users? Are cookies `Secure`, `HttpOnly`, and appropriate `SameSite`; are login/logout/reset flows resistant to fixation and stale sessions? | Separate source facts from deployment cookie/TLS facts. Unknown production attributes are `要確認`, not assumed `NG`. Fixed demo codes must be scoped and incapable of production use. |
| `IPA-1.5` | クロスサイト・スクリプティング | Where can user-controlled values reach HTML, attributes, URLs, scripts, CSS, SVG, Markdown, rich text, or DOM mutation? Are context-aware escaping and safe React text rendering preserved? | Framework auto-escaping is evidence only for normal text nodes. Trace escape hatches such as raw HTML, template concatenation, URL schemes, third-party widgets, and generated downloads. |
| `IPA-1.6` | CSRF | Which cookie-authenticated state changes exist? Are same-site cookies, synchronizer/double-submit tokens, Origin/Referer validation, or Fetch Metadata used consistently, including login/logout and upload actions? | Bearer-only APIs may be `対象外` only after proving browsers cannot ambiently attach authority. CORS alone is not CSRF protection. |
| `IPA-1.7` | HTTPヘッダ・インジェクション | Can untrusted data reach response headers, redirects, filenames, cookies, cache keys, proxy headers, or log-to-header paths? Do framework APIs reject CR/LF and unsafe values? | Establish both attacker control and header construction. Prefer framework setters plus validated values; unknown proxy rewriting is a named deployment gap. |
| `IPA-1.8` | メールヘッダ・インジェクション | Is email sent? Can user data affect `To`, `Cc`, `Bcc`, `From`, `Reply-To`, `Subject`, or raw MIME headers? Are addresses parsed and header line breaks rejected? | If no mail surface exists, cite dependency/config/source evidence and mark `対象外`. Do not send test mail or use real addresses. |
| `IPA-1.9` | クリックジャッキング | Can authenticated or sensitive pages be framed? Are `Content-Security-Policy: frame-ancestors` and/or `X-Frame-Options` applied at the correct server/proxy layer? Are intentional embedding origins narrowly defined? | Missing source header may be `要確認` when deployment injects headers. `NG` needs a confirmed framing exposure and meaningful user action or disclosure. |
| `IPA-1.10` | バッファオーバーフロー | Which native modules, FFI calls, image/document/media decoders, archive handlers, database drivers, binary parsers, or converters process untrusted bytes? Are versions bounded and parsing isolated? | Never auto-mark `対象外` because TypeScript/JavaScript is memory-safe. Trace native/transitive boundaries. Use `対象外` only when no untrusted binary/native parser surface exists in the stated scope. Dependency presence alone is not a confirmed exploitable overflow. |
| `IPA-1.11` | アクセス制御や認可制御の欠落 | Is the user derived from the trusted session at every entry point? Does each read/write enforce object, tenant, role, and lifecycle ownership? Can client-supplied IDs select another user's resource? Are admin, share, import/export, image, and generated-artifact paths covered? | Authentication is not authorization. `OK` needs representative entry-point-to-query/storage traces; `NG` names the lower-trust principal, unauthorized resource/action, missing check, and outcome. |

## Supplemental Checks

| ID | Area | Source questions | Decision cautions |
|---|---|---|---|
| `SUP-01` | CORS and cross-origin API access | Are allowed origins exact and environment-specific? Are credentials, methods, headers, preflight caching, `null` origin, and error paths constrained? | A permissive response is `NG` only when it exposes a protected action or response to an untrusted origin. |
| `SUP-02` | Browser side-channel and isolation | Are Fetch Metadata, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Cross-Origin-Embedder-Policy`, cache controls, and sensitive response types appropriate? | These headers are context-dependent. Record absent but non-required hardening as `要確認` or an informational note unless a concrete cross-origin outcome is established. |
| `SUP-03` | Secrets and environment configuration | Are secrets kept outside source/client bundles/logs? Are demo credentials and fixed codes guarded from non-demo environments? Are configuration failures fail-closed? | Do not open `.env*` or credential files. Inspect names, loaders, guards, and call sites only. |
| `SUP-04` | Errors, logs, and observability | Do errors avoid stack traces, SQL, paths, tokens, personal data, and authorization detail? Are audit events useful without recording sensitive values? | Never reproduce real log contents. Use logging calls, serializers, and dummy values as evidence. |
| `SUP-05` | Dependencies and supply chain | Are manifests and current lockfiles consistent? Are install scripts, unpinned remote assets, vulnerable/deprecated packages, and native/transitive parsers understood? | Do not install, update, or fetch dependencies. Advisory status requires an authorized, current dependency audit; otherwise state the source-only limitation. |
| `SUP-06` | Deployment, TLS, backup, and recovery | Are TLS, trusted proxy, security headers, database privilege, backup/restore, storage permissions, and production/demo separation defined and testable? | Source cannot prove deployed state. Mark exact external facts `要確認`; do not probe infrastructure or claim account/control-plane coverage. |

## Result Rules

- `OK`: Trace the relevant input/action to the intended control and sink. Name the evidence and the bounded scope. The absence of a suspicious text pattern is insufficient.
- `NG`: Establish a real control failure or independently validated boundary violation. For source-only work, every decisive fact must be visible in source; otherwise use `要確認`.
- `要確認`: Name one or more exact missing facts, who can obtain them, and the safe next validation step.
- `未実施`: The row is in scope but inspection or permitted validation was blocked. Name the blocker; sandbox absence blocks target-controlled execution, not ordinary source tracing.
- `対象外`: Prove that the surface does not exist in the declared scope using source, dependency, and architecture evidence. Do not use it merely because the primary framework normally handles the issue.

## Mapping and Deduplication

Create all checklist rows even when several map to one Cloudflare coverage unit. A checklist row records coverage; a finding records a root cause.

Use one finding fingerprint for the same source location, missing/failed control, boundary, affected resource, and outcome. Attach all applicable references, for example `frameworks: [IPA-1.6, SUP-01, CFSA:<coverage-id>]`. Separate findings only when remediation or affected boundary differs materially.
