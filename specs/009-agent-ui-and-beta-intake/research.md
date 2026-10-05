# 009-agent-ui-and-beta-intake — Discovery & Research Log

Created during `/sdd-plan`. Records investigations, decisions, and risks that inform the design.

## Discovery type

**Extension (light)**。既存の Web UI、依存更新手順、FastAPI レーンを拡張する。新しいサービス、DB、認証経路は追加しないが、UI 基盤の段階移行、TypeScript major 更新、Python runtime 更新を含むため、各境界を個別に調査した。

## Investigations

### Q1: 現在の Client JS / CSS 基準値

- **Question**: Carbon のみの現行構成が 22 kB の CSS 予算に対してどれだけ余裕を持つか。
- **Findings**: 2026-10-03 に `mise run build && mise run size` を実行し、Client JS は **384.2 kB brotli**、Client CSS は **19.94 kB brotli** だった。CSS の余裕は 2.06 kB しかない。ビルドは成功したが、Carbon 配下の Sass `if()` 非推奨警告が 6 件出た。
- **Evidence**: command output (2026-10-03); `.size-limit.json`; `apps/web/src/assets/styles/global.scss`

### Q2: preflight なしの Tailwind v4 と走査範囲

- **Question**: Carbon 共存中に preflight を無効化しつつ、`apps/web/src` だけを走査できるか。
- **Findings**: Tailwind v4 は `theme.css` と `utilities.css` を個別 import し、`preflight.css` を省略できる。走査範囲を制御する `source(...)` は utilities import に付ける。`src/assets/styles/tailwind.css` をエントリにする場合、`source("../..")` が `apps/web/src` を指す。
- **Evidence**: Tailwind CSS official docs, `preflight.mdx` and `detecting-classes-in-source-files.mdx` (Context7 `/tailwindlabs/tailwindcss.com`, 2026-10-03)

### Q3: Tailwind と Carbon の CSS エントリ分離

- **Question**: Tailwind import を Sass 経由にするか、独立した CSS として読むか。
- **Findings**: 共存期間は `global.scss` を Carbon 専用のまま維持し、`tailwind.css` を別エントリとして `layout.tsx` から読む。これにより PostCSS の Tailwind 処理と Sass の Carbon 処理を分離し、最後の Carbon 画面を移した時点で `global.scss` だけを削除できる。Tailwind 側は `@layer theme, base, components, utilities` を明示し、共存中は base layer を空にする。
- **Evidence**: `apps/web/src/app/layout.tsx`; `apps/web/src/assets/styles/global.scss`; Tailwind official preflight docs

### Q4: AI SDK v7 の停止理由

- **Question**: サーバ契約を変えずにクライアントが `finishReason` を取得できるか。
- **Findings**: インストール済み AI SDK v7 の `ChatOnFinishCallback` は `finishReason?: FinishReason`、`isAbort`、`isDisconnect`、`isError` を返す。`useChat` の返却値そのものには永続的な `finishReason` 状態がないため、`Chat` が `onFinish` で表示用状態へ保存する。`RunStopReason` を metadata に追加しない。ユーザー停止は `isAbort`、正常完了や長さ制限等は `finishReason` から表示する。
- **Evidence**: `node_modules/.pnpm/ai@7.0.122_zod@4.6.5/node_modules/ai/src/ui/chat.ts:169-185,997-1004`; `docs/04-ai-sdk-ui/02-chatbot.mdx`

### Q5: Carbon TextArea の SCSS 依存

- **Question**: `ApprovalPanel` 移行時に `text-input` / `form` の Carbon styles を削除できるか。
- **Findings**: Carbon の `text-area/_text-area.scss` は `../form` を直接 `@use` する。chat の `TextArea` が残る間は `text-area` とその推移依存である `form` が必要だが、`text-input` は `ApprovalPanel` の `TextInput` 撤去と同じ PR で削除できる。
- **Evidence**: `node_modules/.pnpm/@carbon+styles@1.116.0_*/node_modules/@carbon/styles/scss/components/text-area/_text-area.scss`; `apps/web/src/assets/styles/global.scss:28-32`

### Q6: Dependabot で `packages/schemas` だけ TypeScript 6 を維持

- **Question**: root workspace は TS 7、codegen package は TS 6 という二層を Dependabot に表現できるか。
- **Findings**: root の npm update entry に workspace 全体へ効く TypeScript ignore を残すと root の TS 7 更新まで止まる。設計は root entry から `packages/schemas/package.json` を `exclude-paths` で除外し、`directory: "/packages/schemas"` の npm entry を追加して TypeScript `>=7` を ignore する。後者は 24h cooldown を持ち、repo guard が「root は TS 7」「schemas は TS 6」「局所 ignore」を別々に検証する。Dependabot の pnpm workspace/lockfile 解決は実装 PR で検証し、成立しない場合は R5 を止めて専用 codegen workspace ADR へ戻す。
- **Evidence**: `.github/dependabot.yml`; `tests/repo/dependabot.spec.ts`; GitHub Dependabot configuration options reference (2026-10-03)
- **Superseded (2026-10-03, plan.md DES-1.8)**: 上の `exclude-paths` + `/packages/schemas` 専用 entry 案は採らない。npm entry は `directory: "/"` の 1 つで pnpm workspace の単一 lockfile 全体を扱うため、専用 entry は同じ lockfile へ重複 PR を生む。plan.md は `typescript` の ignore を `versions: [">=7"]` から `update-types: ["version-update:semver-major"]` へ置き換える方式を正とする（`packages/schemas` の 6→7 とルートの 7→8 を止め、ルートの 7.x minor/patch と schemas の 6.x patch は通す）。

### Q7: ハブ本体での TypeScript 7 検証範囲

- **Question**: ベータ記録以外に本リポジトリで何を再検証すべきか。
- **Findings**: ベータレーンは Next 16.3.8、Node 24、TS 7.0.2 と、`packages/schemas` に隔離した TS 6 codegen を検証済みである。本リポジトリ固有の構成は実装 PR で lockfile を更新した後に `openapi:gen` の byte-identical、`check`、`build`、`size`、`test:e2e` を通して確定する。plan フェーズでは依存を変更しないため未実行とする。
- **Evidence**: `../next-agentic-stack/docs/beta-lane/2026-10-03-ts7-compiler-api.md`; `mise.toml`; Requirement 5.3-5.5

### Q8: Pydantic AI のモデル向け docstring

- **Question**: Google-style docstring のどこがモデルへ渡り、出力型の docstring も対象か。
- **Findings**: tool の先頭説明は tool description、`Args` の parameter descriptions は JSON schema に渡る。`RunContext` 自体はモデル引数から除かれるが、モデル向けでない記述を docstring に残すべきではない。`ToolOutput` は既定で Pydantic model/output function の docstring を description に使い、`NativeOutput` も明示 description を持てる。したがって監査対象は登録 tool に加えて `ChatOutput` とし、`Req 10.2` 等の開発者向け記述をコードコメントへ移す。
- **Evidence**: Pydantic AI official docs `tools.md`, `output.md` (Context7 `/pydantic/pydantic-ai/v1.97.0`); `services/api/app/agents/chat_agent.py:20-30`; `services/api/app/agents/tools_mock.py`

### Q9: SSE budget error の usage counts

- **Question**: `requests` / `tool_calls` / `total_tokens` を `Error.message` へ含め続けるか。
- **Findings**: 値は raw prompt、tool args、tool output、secret を含まない集約値であり、429 の rate limit response とも明確に別である。現状を維持し、intake report に「SSE は error event、非 stream は 200 + stop reason、timeout は 504、HTTP rate limit のみ 429 + Retry-After」と記録する。上限値や例外原文は返さない。
- **Evidence**: `services/api/app/api/v1/_stream.py:349-359`; `services/api/app/api/v1/agent.py`; `services/api/docs/owasp-agentic-llm-mapping.md`

### Q10: `ApprovalPanel` のテスト境界

- **Question**: 未マウントの `ApprovalPanel` を a11y E2E のためにページへ接続するか。
- **Findings**: 本 spec では接続しない。ページ追加は auth、job ownership、存在秘匿を設計対象へ引き込む。`ApprovalPanel.spec.tsx` を契約の正本として変更せずに通し、既存 approval E2E は route contract 回帰として維持する。chat の approval-requested 状態だけを `page.route("**/api/chat")` で a11y E2E に追加する。
- **Evidence**: `apps/web/src/app/page.tsx`; `apps/web/tests/ApprovalPanel.spec.tsx`; `apps/web/tests/e2e/a11y.spec.ts`; gap analysis Q10

### Q11: Carbon CDN 撤去後のフォント

- **Question**: IBM Plex CDN を `next/font` へ置換するか、system font にするか。
- **Findings**: system font stack を採用する。フォント download、追加 asset、外部 CDN、Next font の build-time fetch を増やさず、Carbon 撤去で Akamai 依存も同時に消せる。テーマ token の `--font-sans` で宣言する。
- **Evidence**: `apps/web/src/assets/styles/global.scss:5-20`; privacy/reproducibility constraints in steering

## Existing patterns to reuse

| Pattern | Location | Why reuse |
|---------|----------|-----------|
| feature-first UI composition | `apps/web/src/features/chat/`, `apps/web/src/features/jobs/` | screen-specific state/transport と shared presentation を分離できる |
| AI SDK v7 typed UI parts | `apps/web/src/features/chat/MessageItem.tsx` | `ToolUIPart` 判別と approval response の既存契約を維持する |
| neutral callback-based view component | `ChatComposer` props pattern | shared component が API、監査、永続化を所有しない |
| jobs approval normalization and consume-once | `apps/web/src/lib/approvals.ts`; approve route | UI 移行で security boundary を変更しない |
| jsdom + Testing Library | `apps/web/tests/Chat.spec.tsx`, `ApprovalPanel.spec.tsx` | network-free な表示/操作回帰を検証する |
| Playwright route mocking + axe | `apps/web/tests/e2e/a11y.spec.ts` | モデルなしで approval-requested UI の a11y を検証できる |
| repository policy guards | `tests/repo/dependabot.spec.ts` | dependency policy の誤設定を機械検出する |
| FunctionModel/TestModel schema inspection | `services/api/tests/unit/agents/test_tools_mock.py` | model-facing description を実測できる |
| independent Python lane pin | `services/api/.python-version`, `test_python_version_pin.py` | services/api だけを 3.14 へ移行できる |

## External dependencies

| Dependency | Version policy | Purpose | Verified |
|------------|----------------|---------|----------|
| `tailwindcss` | stable 4.x, 24h minimum age | utility generation and theme variables | beta record + official docs |
| `@tailwindcss/postcss` | same stable 4.x line | Next/Turbopack PostCSS integration | beta record + official docs |
| `radix-ui` | stable caret version passing 24h rule | shadcn primitives used by copied components | beta record |
| `class-variance-authority` | stable caret version passing 24h rule | typed UI variants | beta record |
| `clsx` | stable caret version passing 24h rule | conditional class composition | beta record |
| `tailwind-merge` | stable caret version passing 24h rule | conflict-safe `cn()` | beta record |
| `lucide-react` | newest stable version passing 24h rule | accessible icons | beta record |
| `typescript` (root) | stable 7.x, no prerelease | workspace compiler | TS beta record |
| `typescript` (`@vaz/schemas`) | exact/caret 6.0.3 line until codegen supports 7 | `openapi-typescript` compiler API compatibility | TS beta record |
| `openapi-typescript` | existing 7.13.0 moved, not upgraded by this decision | OpenAPI code generation | TS beta record |

No new runtime service, DB, authentication provider, or Python package is introduced.

## Architecture decisions

### ADR-1: Carbon と Tailwind のエントリを共存期間だけ分離する

- **Context**: Carbon reset と Tailwind preflight は競合し、現 CSS budget の余裕は 2.06 kB しかない。
- **Decision**: `global.scss` は Carbon 専用、`tailwind.css` は theme + utilities 専用とする。最後の Carbon screen の移行後に `global.scss` を削除し、`tailwind.css` へ preflight を追加する。
- **Alternatives**: Sass から Tailwind import（処理系と layer の責任が混ざる）、最初から preflight 有効（R1.2 違反）。
- **Consequences**: `layout.tsx` は移行中だけ 2 entry を import する。CSS size を各 PR で測る。

### ADR-2: agent-ui は中立 props を受ける表示専用コンポーネントにする

- **Context**: chat と jobs は approval input と transport が異なる。
- **Decision**: `ApprovalCard`、`ToolExecution`、`StreamingStatus` は primitive values、AI SDK/Pydantic-derived display types、typed callbacks のみを受ける。chat/jobs adapter が固有型を写像する。
- **Alternatives**: component 内で `fetch`/`addToolApprovalResponse` を呼ぶ、画面型を union のまま渡す。
- **Consequences**: policy、auth、persistence、audit は既存 owner に残る。兄弟 repo へ component source をコピーしやすい。

### ADR-3: 停止理由は `useChat.onFinish` のクライアント状態だけで表示する

- **Context**: `RunStopReason` はクライアントへ届かず、server metadata 追加は out of scope。
- **Decision**: `finishReason` と abort/error flags を `Chat` で保持して `StreamingStatus` に渡す。
- **Alternatives**: UI message metadata 拡張、agent audit event の再送。
- **Consequences**: server-internal stop reason と完全一致しないことを component contract に明記する。

### ADR-4: TypeScript compiler を runtime workspace と codegen workspace で二層化する

- **Context**: root は TS 7 へ進めるが、`openapi-typescript` 7.13.0 は TS 7 compiler API を利用できない。
- **Decision**: `@vaz/schemas` に `openapi-typescript` と TS 6.0.3 を置き、`mise run openapi:gen` は filter 経由で実行する。root は TS 7 stable とする。
- **Alternatives**: codegen 専用 package 新設（構造変更が大きい）、上流対応まで TS 7 を延期。
- **Consequences**: Dependabot policy と repo guard も二層化する。上流対応後は schemas の TS 6 を撤去する。

### ADR-5: Python beta intake は実装変更より evidence artifact を正本にする

- **Context**: L1、L2、L4 は既存で充足し、L3 も小さな model-facing description 修正だけである。
- **Decision**: `services/api/docs/python-beta-intake-2026-10.md` に route/status、citation fail-closed、tool/output description、direct `Model.request()` inventory をまとめる。テストで inventory と model-facing schema を固定する。
- **Alternatives**: 既存 code を不要に再実装する、兄弟 repo の文書だけを更新して hub に証跡を残さない。
- **Consequences**: sibling report はこの artifact への参照として行える。

### ADR-6: Python 3.14 は外部トリガー成立後の独立 PR にする

- **Context**: R7.1 は `pydantic-ai-sandbox` spec 014 R1 の実測記録を event trigger とする。
- **Decision**: plan には変更境界を定義するが、トリガー前は実装しない。実装時は `.python-version`、Docker、Ruff、docs、Dependabot を一体更新し、3.15 は対象外とする。
- **Alternatives**: hub 側だけで先行移行、services/agent も同時更新。
- **Consequences**: R7 は他の task と分離され、前提未成立なら pending のまま残る。

## Risks & open questions

- ⚠️ 現 CSS budget の余裕は 2.06 kB — mitigation: Tailwind foundation PR で build/size を先に測り、超過時は component 導入前に token/utility 範囲を削る。（2026-10-03 改訂: plan.md は判定を UI-1 の完成形（primitives と agent-ui を含む）で、Client CSS の絶対値 ≤ 22 kB に対して行う方式に改めた。component の導入を遅らせる案は R3.1 の移行順序を崩すため採らない。plan.md「CSS budget during coexistence」が正本。）
- ⚠️ `ApprovalPanel` は未マウント — mitigation: unit contract を正本とし、ページ追加を本 spec に含めない。
- ⚠️ 既存 E2E が CSS class/DOM parent に依存 — mitigation: `toolOutput`、`role="status"`、role label の親構造を保持するか、同一 PR で locator を意味的属性へ移す。
- ⚠️ Dependabot の `typescript` semver-major ignore（plan.md DES-1.8。nested workspace entry 案は廃止）— mitigation: TS-7 PR で repo guard の期待値を先に変えて RED を確認し、ルートの 7.x minor が届き schemas の 6→7 が止まることを検証する。成立しない場合は R5 を止めて ADR-0009 を改訂する。
- ⚠️ 憲章 Additional Constraints が TypeScript 6.x と Python 3.13 を固定している — mitigation: TS-7 PR は ADR-0009 と憲章改正を先頭に置き（tasks 5.1）、R7 PR は同じ PR で Python の記述を改正する（tasks 7.2）。
- ⚠️ TS 7 gate は本 repo で未実測 — mitigation: dependency PR は他変更と混ぜず、required gate すべてを実行する。
- ⚠️ Python 3.14 trigger は未成立の可能性 — mitigation: sibling evidence の commit/link を task entry condition にする。
- ❓ Carbon 全撤去後の CSS headroom — resolve in R4 PR by measured size; measured value plus documented headroom only.
