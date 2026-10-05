# 009-agent-ui-and-beta-intake — 実装ギャップ分析

- **作成日**: 2026-10-03（`main`@`afbe6eb`）
- **入力**: [spec.md](./spec.md)（要件は未承認）、`.sdd/steering/`、ベータレーンの記録 3 本（`next-agentic-stack` の `docs/beta-lane/2026-10-03-{shadcn-tailwind,ts7-compiler-api}.md`、`pydantic-ai-sandbox` の `docs/hub-intake-2026-10.md`）
- **凡例**: ✅ 既存で充足 / 🔧 一部あり（拡張が要る） / 🆕 無い（新規） / ⏸ 前提未成立

## 1. 分析サマリー

- **UI（R1〜R4）はほぼ新規だが小さい。** Carbon を使うのは 4 ファイル・計 528 行。Tailwind・shadcn・`components/` はどれも無い。実質的な難所はコードの量ではなく、(1) 共存期間の CSS（preflight なし・Carbon の reset と `@layer` の優先順位・22 kB の余裕が未計測）、(2) E2E が Carbon / CSS Modules の DOM に依存している 3 箇所（`[class*="toolOutput"]`、`role="status"`、`xpath=..`）。
- **spec の前提とコードがずれている点が 3 つある。** (a) `ApprovalPanel` はどのページにもマウントされておらず、R3.2 が挙げる E2E はどれもこれを描画しない（契約を実際に守っているのは R3.2 に無い `ApprovalPanel.spec.tsx`）。R2.6 の a11y E2E もこのままでは覆えない。(b) 停止理由はクライアントに届いておらず、R2.1 の表示はサーバ側の変更を引き込む可能性がある。(c) 承認カードの入力は chat（引数あり・編集なし）と jobs（引数なし・編集あり）で形が違い、R2.1 の「予定の引数＋編集」を両方で満たす入力は無い。
- **TS 7（R5）はベータ記録の手順でほぼ足りる。** 未解決は 2 点: Dependabot の `ignore` が `dependency-name` 単位でワークスペース全体に効くため「`packages/schemas` の TS だけ 6.x に留める」が書けない可能性、ハブのソースでの `apps/worker` / `apps/web` の `tsc` と E2E が未検証。
- **Python の L1〜L4（R6）は大半が既に満たされている。** L1 は 200（`stop_reason`）/ 504 / SSE `Error` で 429 と区別済み。L2 は引用を検索結果から構築し、集合外は 502 で fail-closed（spec の「除去して記録」とは挙動が違う）。L4 は `health.py` の 1 箇所だけ。L3 は登録ツールが mock 1 つで対応済みだが、出力型 `ChatOutput` の docstring（開発者向けの記述を含む）がモデルに渡る点が新たに見つかった。
- **R7（3.14）は前提待ち**（サンドボックス spec `014` R1 の記録が未作成）。R7.2 の更新箇所の列挙には過不足があり（`mise.toml` は実体なし、Dockerfile・Ruff の `target-version`・Dependabot docker ブロックの分割が漏れ）、spec の修正候補。

## 2. 要件別ギャップ表

### R1: shadcn/ui + Tailwind CSS の導入

調査時点: `main`@`afbe6eb`（2026-10-03）。根拠となる検証記録: `next-agentic-stack` の `docs/beta-lane/2026-10-03-shadcn-tailwind.md`。

| # | 状態 | 根拠・ギャップ |
|---|---|---|
| 1.1 | 🆕 | `apps/web` に Tailwind も shadcn も無い。`postcss.config.*`・`components.json`・`apps/web/src/components/`・`cn()` を置く `utils.ts` がどれも存在しない。`@/*` → `./src/*` の alias（[apps/web/tsconfig.json](../../apps/web/tsconfig.json)、[apps/web/vitest.config.ts](../../apps/web/vitest.config.ts)）はそのまま shadcn の `aliases` に使える。ベータ記録では追加の Next 設定は不要で、`postcss.config.mjs` だけで Turbopack に組み込めた。shadcn CLI はベータ側でも使えず、new-york v4 のソースを手で写している |
| 1.2 | 🆕 | 現在のエントリは `global.scss`（[layout.tsx:3](../../apps/web/src/app/layout.tsx#L3) で import）で、Carbon の `reset` を読んでいた。§4 で削除済み。Tailwind のエントリ CSS を**別ファイル**にして `layout.tsx` で並べて import するか、`global.scss` から読むかは未決（Sass から Tailwind の `@import` を通せるかは要確認、§5）。ベータ記録の数値（3.89 kB）は preflight **あり**の値で、preflight なしの数値は実測が無い |
| 1.3 | 🆕 | ベータ記録の `@import "tailwindcss" source("../")` は preflight ありの一括 import。preflight を外す分割 import（`@import "tailwindcss/theme" …; @import "tailwindcss/utilities" … source(...)`）での `source()` の付け方はベータ側で未検証 |
| 1.4 | 🔧 | 上限は [.size-limit.json](../../.size-limit.json) に Client CSS 22 kB で存在する。**現在値の実測が spec にも本分析にも無い**ので、共存期間の余裕（22 kB − 現 Carbon CSS − Tailwind の固定費 約 1.7 kB（preflight 抜き推定））が分からない。plan の最初に `mise run build && mise run size` で基準値を取る必要がある |
| 1.5 | 🔧 | `allowBuilds` の運用は [pnpm-workspace.yaml](../../pnpm-workspace.yaml) に既にある（Carbon・`@parcel/watcher`・`sharp` などを `false` で記録）。ベータ記録では新規依存に install スクリプトは無かった（`@tailwindcss/oxide` はビルド済みバイナリの optional 依存）。ハブでも `pnpm ignored-builds` で再確認し、無ければ記録不要か「明示的 deny」で残すかを既存コメントの流儀（`pg`・`inngest` は fail-safe として `false` を記録）に合わせて決める |
| 1.6 | 🔧 | [.github/dependabot.yml](../../.github/dependabot.yml) の npm ブロックには `ai-sdk` グループしか無い。ベータ側にある `dev-tooling` グループはハブに**存在しない**ので、`tailwindcss` / `@tailwindcss/postcss` の扱い（`ui` に含めるか、ungrouped のままか）は別途決める必要がある。[tests/repo/dependabot.spec.ts](../../tests/repo/dependabot.spec.ts) は現在グループを一切検査していない（`HELD_BACK` と ecosystem 網羅・cooldown のみ）ので、「合わせて更新」は新しいテストケースの追加になる |
| 1.7 | 🆕 | 規約としての担保が無い。画面＝`features/<feature>/` 単位で `@carbon/react` と `@/components/ui` を同時に import していないことを `tests/repo/` のガードで検査する案がある（任意。§4） |

依存の追加候補（ベータ記録と同じ）: `tailwindcss`・`@tailwindcss/postcss`（dev）、`radix-ui`（約 60 個の `@radix-ui/*` がロックに入る。部品別 `@radix-ui/react-*` の選択肢あり）・`class-variance-authority`・`clsx`・`tailwind-merge`・`lucide-react`（`minimumReleaseAge` で 1.50.0 は採れなかった）。

### R2: エージェント UI 部品の共通化

| # | 状態 | 根拠・ギャップ |
|---|---|---|
| 2.1 承認カード | 🔧 | 承認 UI は**形の違う 2 実装**として存在する。(a) chat: [MessageItem.tsx](../../apps/web/src/features/chat/MessageItem.tsx) の `ToolApprovalRequest`（`ToolUIPart` の `approval-requested` 状態、承認／却下のみ、`requestReason` を表示、**引数は表示していない**、編集なし）。(b) jobs: [ApprovalPanel.tsx](../../apps/web/src/features/jobs/ApprovalPanel.tsx) の `ApprovalDecisionForm`（`JobEvent` の `step-start` から `kind`・`stepId` を表示、承認／拒否、JSON 引数の**上書き入力**）。jobs 側は、ゲートが specialist 実行**前**に止まるため「予定の引数」を持つイベントが存在しない（同ファイル 99–104 行のコメント）。つまり R2.1 の「ツール名・予定の引数・承認／却下／編集」をそのまま満たす入力は、chat（引数あり・編集なし）にも jobs（引数なし・編集あり）にも無い |
| 2.1 ツール呼び出し表示 | 🔧 | `MessagePart` が `Tag` + `JSON.stringify(part.output)` を `<code className={styles.toolOutput}>` で出している（[MessageItem.tsx:66-89](../../apps/web/src/features/chat/MessageItem.tsx#L66-L89)）。状態（`input-streaming` / `output-error` など）の区別は無い |
| 2.1 ストリーミング・停止理由 | 🆕 | ストリーミング中表示は `InlineLoading`（`status === "submitted"` のみ）。**停止理由はクライアントに届いていない**: `deriveStopReason`（[stop-reason.ts](../../packages/agents/src/stop-reason.ts)）は `onEnd` で OTel 属性と `recordRun` に書くだけで、UI message stream の metadata には載せていない。表示するには (i) AI SDK v7 の `useChat` 側で取れる `finishReason` を使う、(ii) chat route / agent で `messageMetadata` に `RunStopReason` を載せる、のどちらか。(ii) はサーバ側の変更になり、本 spec の「表示層だけ」（Out of Scope）と緊張関係にある（§5） |
| 2.2 | ✅（維持） | 判定は [approvals.ts](../../apps/web/src/lib/approvals.ts)、監査は `recordApprovalDecisions` の単一発火点。UI 側は現在も `fetch` と `addToolApprovalResponse` を呼ぶだけで、判定・監査を持っていない。部品化でこの境界を崩さないこと（送信は部品ではなく画面＝`features/*` 側に残す） |
| 2.3 | 🔧 | chat 側は既に AI SDK v7 の `ToolUIPart` / `DynamicToolUIPart` / `ChatAddToolApproveResponseFunction` で型付け済み。jobs 側は `@vaz/schemas/workflows` の `JobEvent` / `SpecialistKind`。共通の承認カードを作るなら、両方から写像できる**中立の props**（`toolName`・`input?: unknown`・`reason?`・`editable`・`onDecide`）が必要で、その型を `@vaz/schemas` に置くか部品ファイル内に置くかは未決 |
| 2.4 | 🔧 | 現 UI はログ・テレメトリへ引数を出していない（`console.*` は無い）。逆に**画面には `part.output` を生 JSON で全件表示している**（R2.4 は引数の画面表示を承認カードに限るが、出力の画面表示は規定していない）。部品化で `JSON.stringify` を残すかどうかは R3.3（`locator` 引用の表示）と合わせて決める |
| 2.5 | 🆕 | 参照元のトークン（`@theme`）は `from-genai-to-agentic-ai` の **`001-agentic-ai-platform` ブランチ**の `apps/web/app/globals.css` にだけあり、その既定ブランチには無い。M4 の承認ダイアログに当たる `*.tsx` は同ブランチを含めて見つからなかった（承認 UI はまだ教材側に無く、ハブが先に作る関係になる）。ハブ側にテーマトークンは無い（Carbon の `g10` テーマを `<Theme>` で当てているだけ） |
| 2.6 単体 | 🔧 | jsdom の単体テスト基盤は既にある（[ApprovalPanel.spec.tsx](../../apps/web/tests/ApprovalPanel.spec.tsx)、[Chat.spec.tsx](../../apps/web/tests/Chat.spec.tsx)。role・label・placeholder で引いているので部品の差し替えに強い）。部品ごとの新規 spec が要る |
| 2.6 a11y E2E | 🆕 | **`ApprovalPanel` はどのページにもマウントされていない**（`apps/web/src/app` の `page.tsx` は `/` の `Chat` だけ）。[a11y.spec.ts](../../apps/web/tests/e2e/a11y.spec.ts) は `/` の初期状態とエラー状態しか見ていない。承認カード（chat の `approval-requested`）を a11y E2E で覆うには、`page.route("**/api/chat")` で UI message stream を返すモックが要る。jobs の承認カードを覆うには、マウント先のページ（例: `/jobs/[id]`）か E2E 用のハーネスが要る — どちらも現状は無い |

部品の置き場 `apps/web/src/components/agent-ui/` は [structure.md](../../.sdd/steering/structure.md) の「feature-first」（`features/<feature>/`）と並ぶ新しい層になる。shadcn の `components/ui/` と合わせ、steering への追記候補。

### R3: 画面単位の移行

| # | 状態 | 根拠・ギャップ |
|---|---|---|
| 3.1 | 🔧 | 対象 4 ファイルは計 528 行（`Chat` 86 / `ChatComposer` 91 / `MessageItem` 119 / `ApprovalPanel` 232）と小さい。`ApprovalPanel` は**未マウント**なので、PR 1 は本番の画面を何も変えない（リスクは低いが、移行の効果を E2E・バンドルで観測できない。`next build` は未使用のクライアント部品をバンドルに含めないため、`mise run size` の差も PR 1 では Tailwind の固定費しか出ない可能性が高い） |
| 3.2 | ✅（ただし空虚に近い） | 列挙された E2E は `ApprovalPanel` を**描画しない**。[approval-resume.spec.ts](../../apps/web/tests/e2e/approval-resume.spec.ts) はワーカーの関数（`registerWorker` / `submitJob` / `submitApproval`）を偽の `DurableEngine` で直接駆動する。[hitl-approval.spec.ts](../../apps/web/tests/e2e/hitl-approval.spec.ts) は chat の承認。a11y は `/` のみ。承認ルートの 400/404/409/429 は route の単体テスト（[jobs-approve-route.spec.ts](../../apps/web/tests/jobs-approve-route.spec.ts)）で守られ、UI 変更の影響を受けない。**実際に `ApprovalPanel` の契約（送信本文 `{toolCallId, decision, args?}`、JSON 検証、否認理由の表示）を守っているのは [ApprovalPanel.spec.tsx](../../apps/web/tests/ApprovalPanel.spec.tsx) の 10 件**で、R3.2 の列挙に入っていない。これを「変更せずに通す」対象に加えるべきか、plan で判断が要る |
| 3.3 | 🔧 | 承認／却下の挙動は [Chat.spec.tsx](../../apps/web/tests/Chat.spec.tsx) と `hitl-approval.spec.ts` が role + 名前（「承認」「却下」）で引いているので部品差し替えに耐える。**壊れるのは次の 3 箇所**: (1) [locator-citation.spec.ts:182](../../apps/web/tests/e2e/locator-citation.spec.ts#L182) が `[class*="toolOutput"]` という CSS Modules のクラス名に依存しており、R3.4 で `Chat.module.scss` を消すと一致しなくなる。(2) [a11y.spec.ts](../../apps/web/tests/e2e/a11y.spec.ts) のエラー状態テストが「Carbon の `InlineNotification` は `role="status"`」を前提に `getByRole("status")` を待つ。(3) `chat-{anthropic,openai,ollama}.spec.ts` が `getByText("AI").locator("xpath=..")` でメッセージ枠を親要素として辿っており、DOM の入れ子が変わると壊れる。いずれも「テストを変えずに通す」には、置き換え後の DOM で `toolOutput` を含むクラスか `data-*` 属性、`role="status"`、ラベルの直接の親＝メッセージ枠、を意図して保つ必要がある |
| 3.4 | 🔧 | `Chat.module.scss` は chat の 3 ファイルが共有しているので、chat の 1 PR で消せる。`ApprovalPanel` は `*.module.scss` を持たない。Carbon の `@use` のうち `ApprovalPanel` **だけ**が使うのは `text-input` の 1 行（`Button`・`Tag`・`Tile`・`InlineNotification` は chat も使う）。ただし Carbon の `text-area` スタイルが `text-input` / `form` のスタイルに依存しているかは未確認（§5） |
| 3.5 | 🆕 | PR 本文への記録はプロセス要件。CI の `bundle-size` ジョブ（`tests.yml`）は合否だけで数値を PR に残さない。手で `mise run build && mise run size` を移行前後に取る |

### R4: Carbon の撤去と規約の更新

| # | 状態 | 根拠・ギャップ |
|---|---|---|
| 4.1 | 🔧 | 撤去対象は spec の列挙より多い。`apps/web/package.json` の `@carbon/react`・`@carbon/styles`、ルート `package.json` の `sass`（devDependency）に加え、(a) [next.config.ts](../../apps/web/next.config.ts) の `sassOptions.silenceDeprecations`（Carbon の Sass 非推奨を黙らせるためだけの設定）、(b) [pnpm-workspace.yaml](../../pnpm-workspace.yaml) の `allowBuilds` にある `@carbon/*` 12 件と `@ibm/plex*` 9 件、およびその説明コメント、(c) `layout.tsx` の `global.scss` import、(d) IBM Plex の Akamai CDN 読み込み（フォントを何に置き換えるかは未決。`next/font` に寄せるか、システムフォントか） |
| 4.2 | 🔧 | 計測手段（`mise run size`）と上限ファイルはある。下げ幅の「headroom」の決め方は未定義（ベータ側は 4 kB → 6 kB と、部品 1 つ分の余裕で決めた） |
| 4.3 | 🔧 | Carbon 規約は spec が挙げる 2 ファイルの**計 5 箇所**にある: [CLAUDE.md](../../CLAUDE.md) の 30 行（スタック紹介「Carbon Design System for UI」）・36 行（`*.module.scss` の colocation と `@carbon/react` の client 制約）・56 行（「Carbon styles」）、[AGENTS.md](../../AGENTS.md) の 46 行（「Carbon Design System」）・58 行（「Client bundle budget」の「Carbon wholesale import is the usual way to blow it」）。ほかに [.github/workflows/tests.yml:125-126](../../.github/workflows/tests.yml#L125-L126) のコメント、[.sdd/steering/tech.md](../../.sdd/steering/tech.md) の Key Decisions、`README.md`、`docs/cross-repo-adoption-{review,backlog}.md`（前者は append-only なので**書き換えない**）。ペア更新を機械的に守るガードは無い（`doc-links.spec.ts` はリンク到達性だけ） |
| 4.4 | 🔧 | [ADR-0008](../../docs/adr/0008-ui-component-standard.md) の Status は「Accepted（移行は未着手。…）」。書式の前例は ADR-0007 など既存 ADR に合わせる |

### R5: TypeScript 7 の取り込み

根拠となる検証記録: `next-agentic-stack` の `docs/beta-lane/2026-10-03-ts7-compiler-api.md`（対象はハブ `main`@`1a08a97`）。

| # | 状態 | 根拠・ギャップ |
|---|---|---|
| 5.1 | 🔧 | 手順は [dependency-policy.md §8.2](../../docs/dependency-policy.md) にある。ベータ記録に「ハブへ持ち込むときの手順案」1〜5 があり、R5.2〜5.6 とほぼ 1 対 1 に対応する |
| 5.2 | 🆕 | 現状 `openapi-typescript`（^7.13.0）と `typescript`（^6.0.3）はルート `package.json` の devDependencies。[packages/schemas/package.json](../../packages/schemas/package.json) は `zod` しか持たない。[mise.toml](../../mise.toml) の `openapi:gen`（371–390 行）は `pnpm exec openapi-typescript packages/schemas/src/generated/…` を 2 回呼ぶ。`pnpm --filter @vaz/schemas exec` は作業ディレクトリが `packages/schemas` になるので、入出力パスを `src/generated/…` に直す必要がある（ベータ記録は `-o "$PWD/a.ts"` の絶対パスで回避）。`pnpm-workspace.yaml` の `allowBuilds` の `openapi-typescript: false` はワークスペース全体に効くので移動不要 |
| 5.3 | 🔧 | ベータ側でバイト同一を確認済み（同じ 2 スナップショットから）。ただし `openapi:gen` は**両 Python レーン（`services/agent`・`services/api`）からスナップショットを書き出すところから**走るので、ハブで 5.3 を確認するには `uv` と両レーンの依存が要る。スナップショットだけを入力に TS 生成部分を走らせる手順に分けるかは plan で決める |
| 5.4 | 🔧 | 更新箇所は §8.2-2 の列挙どおり存在する: `.github/dependabot.yml` の `typescript >=7` ignore、`tests/repo/dependabot.spec.ts:37` の `HELD_BACK`、[CLAUDE.md:59](../../CLAUDE.md#L59) と [AGENTS.md:71](../../AGENTS.md#L71) の据え置き記述、§8.1 の 1 行目。加えて [.sdd/steering/tech.md](../../.sdd/steering/tech.md) の Constraints（「TypeScript 6.x … を勝手に変更しない」）も更新対象。**未解決の衝突**: Dependabot の `ignore` は `dependency-name` 単位で npm ブロック（`directory: "/"`、ワークスペース全体）に効くため、「`packages/schemas` の TS だけ 6.x に留める」ignore を書くと、ルートの TS 7.x の更新も同時に止まる。また `dependabot.spec.ts` の `HELD_BACK` 検査はルート `package.json` の devDependencies しか読まないので、`packages/schemas` 側の 6.x 固定を守るには検査の拡張が要る（§5） |
| 5.5 | 🔧 | ベータ記録が確認したのは `next typegen`・`next build`（Next **16.3.7**。ハブのロックは 16.3.8）・生成物の `tsc --strict`・`@vaz/evals` の `tsc --ignoreConfig` の受理。**未確認**: `apps/worker` の `tsc --noEmit`（`incremental: true`・`types: ["node"]`）と `apps/web` の `tsc --noEmit`（`incremental`・`allowJs`・`plugins: [{name: "next"}]`）をハブのソースで流した結果、`mise run test:e2e`。`inngest` の `typescript` peer は optional で import も無い（ベータ記録）。リポジトリ内に `typescript` を import するソースは無い（本分析で再確認） |
| 5.6 | 🆕（将来条件） | 検知は `next-agentic-stack` の spec `001` 側。ハブ側では撤去条件を §6 の撤去条件表か §8.1 に残す場所が要る |

補足: tsgo は言語サービスのプラグインを読まないため、`apps/web/tsconfig.json` の `next` プラグインはエディタ上で効かなくなる可能性がある（ゲートには影響しない）。plan で確認する。

### R6: Python ベータレーン L1〜L4

出所: `pydantic-ai-sandbox` の `docs/hub-intake-2026-10.md` §3。

| # | 状態 | 根拠・ギャップ |
|---|---|---|
| 6.1 L1 | ✅（記録のみ。軽微な確認点 2 つ） | 非ストリーミング: [agent.py:97-116](../../services/api/app/api/v1/agent.py#L97-L116) が `UsageLimits`（request / total_tokens / tool_calls）付きの `run_guarded()` を `asyncio.wait_for(timeout=chat_request_timeout)` で囲む。**上限超過は HTTP 200** で `ChatResponse.stop_reason="budget_exceeded"`・`reply="Request stopped: budget_exceeded"` を返し、タイムアウトは **504**（[errors.py](../../services/api/app/api/errors.py) の既定 `code` は `WORKFLOW_TIMEOUT`）。どちらも 429（`RATE_LIMIT_EXCEEDED`、`Retry-After` 付き。[rate_limit.py](../../services/api/app/middleware/rate_limit.py) の `RateLimiter.exceeded_response` が唯一の生成元）と区別されている。ストリーミング: [_stream.py:350-357](../../services/api/app/api/v1/_stream.py#L350-L357) が SSE の `Error` イベントで返す（HTTP ステータスは既に 200 で送出済み）。確認点: (a) 504 の `code` 名 `WORKFLOW_TIMEOUT` は chat のタイムアウトにも流用されている（区別はされているので修正必須ではない）。(b) ストリームの `Error.message` は `requests=…, tool_calls=…, total_tokens=…` の**消費量**を含む。サンドボックス §3.2-3 は「上限値を含む内部メッセージをそのまま返さない」と求めており、消費量の開示をどう扱うかは判断が要る |
| 6.2 L2 | ✅（spec の想定と挙動が違う） | 引用は**モデルが書くフィールドではなく、構築時に検索結果から作る**。[corrective_rag.py:318-361](../../services/api/app/workflows/corrective_rag.py#L318-L361) は `query_with_scores()` の `RetrievedHit` を順序付け・切り詰めた集合をそのまま `citations` にし、さらに [citation.py](../../services/api/app/workflows/citation.py) の `validate_citations` で `state.retrieved_hit_ids` と照合する。集合外があれば `DanglingCitationError` を**送出**し、[rag.py:113-116](../../services/api/app/api/v1/rag.py#L113-L116) が 502 `UPSTREAM_GROUNDING_FAILED` にする。R6.2 の「集合外を除去して記録」とは異なり fail-closed。どちらを正とするか（現状の fail-closed を記録として残すのが自然）を plan で決める。なお回答本文（`answer` の自由文）にモデルが書く ID 風の文字列は照合対象外。TS 側（[packages/rag/src/tools.ts:105-114](../../packages/rag/src/tools.ts#L105-L114)）も `chunks.map(toCitation)` で構築時に作っている |
| 6.3 L3 | 🔧 | 登録されるツールは `mock_web_search`（[tools_mock.py](../../services/api/app/agents/tools_mock.py)、非 production のみ）の 1 つだけで、開発者向けメモは既に「not sent to the model」のコメントへ移してある。残る論点: (a) docstring の `Args: ctx: RunContext providing access to AgentDeps (http_client, settings)` と `Returns:` 節がモデル向け説明に入るか（pydantic-ai の griffe 解析の挙動。§5）。(b) **ツール以外にもモデルへ送られる docstring がある**: 出力型 `ChatOutput`（[chat_agent.py:20-28](../../services/api/app/agents/chat_agent.py#L20-L28)。「Used as the `NativeOutput` schema … (Req 10.2)」という開発者向けの記述を含む）と `RelevanceVerdict`（[models/rag.py:122](../../services/api/app/models/rag.py#L122)）は、JSON Schema の `description` としてモデルに渡る。R6.3 の対象を「ツール」に限るか出力型まで広げるかは判断が要る。監査記録の置き場は既存の [services/api/docs/tool-design-conventions.md](../../services/api/docs/tool-design-conventions.md) への追記が候補 |
| 6.4 L4 | ✅ | `Model.request()` の直接呼び出しは [health.py:171](../../services/api/app/api/health.py#L171) の `_probe_llm_provider` だけ（空の `ModelRequestParameters()`、ツールなしの疎通確認）。ほかは `Agent.run` / `Agent.iter`（`_stream.py`）と `corrective_rag.py` の `Agent(...)` 経由 |
| 6.5 | 🆕 | 報告先の `hub-intake-2026-10.md` §4 の「次の作業」2・3 の状態更新。兄弟リポジトリへの書き込みは本リポジトリの外の PR になる |

### R7: Python 3.14（H3）

| # | 状態 | 根拠・ギャップ |
|---|---|---|
| 7.1 | ⏸（前提未成立） | `pydantic-ai-sandbox` の spec `014` は 2026-10-03 に起票されたばかり（`38d3ddc`）で、Requirement 1（ハブ依存一式の 3.14 での `uv sync` + テスト）の検証記録はまだ無い。`hub-intake-2026-10.md` §2.5 の時点の証拠は「3.14 で `uv lock` が解決する」まで |
| 7.2 | 🔧（列挙に過不足） | **列挙にあるが実体が無い**: `mise.toml` — ルートの `mise.toml` はこのレーンの Python を持たない（[test_python_version_pin.py](../../services/api/tests/unit/test_python_version_pin.py) の docstring が「`.python-version` だけが単一の正本」と明記）。CI の `api.yml` も版を直接書いていない（`uv` が `.python-version` を読む）。**列挙に無いが必要**: [services/api/Dockerfile](../../services/api/Dockerfile) の `FROM python:3.13-slim` ×2、[pyproject.toml](../../services/api/pyproject.toml) の Ruff `target-version = "py313"`、[.github/dependabot.yml](../../.github/dependabot.yml) の docker ブロックの `python >=3.14` ignore（`/apps/worker`・`/services/agent`・`/services/api` の 3 ディレクトリ共通なので、`services/agent` を 3.13 に残すにはブロックの分割が要る。`dependabot.spec.ts` の Dockerfile 網羅検査も影響を受ける）、[.sdd/steering/tech.md](../../.sdd/steering/tech.md) の「Python 3.13」、ルート [AGENTS.md](../../AGENTS.md) の「Python pinned strictly to 3.13」。また `services/api/AGENTS.md:46` は「`.python-version` + `mise.toml`」と書いており、既に古い |
| 7.3 | 🔧 | `api:check` / `api:audit` のタスクは存在する。3.14 での新しい非推奨警告は `filterwarnings = ["error::DeprecationWarning"]` で即失敗になる（サンドボックス §2.3 の罠 2: starlette 1.7 の `StarletteDeprecationWarning` は `UserWarning` 派生で捕まらない。罠 3: redis-py の `asyncio.iscoroutinefunction`） |
| 7.4 | ✅ | 不採用を記録するだけ。根拠は §8.1 と `services/api/CLAUDE.md`「Dependency pins that are load-bearing」に既にある |

## 3. 統合上の課題

1. **preflight なしの共存と Carbon の reset の順序。** `global.scss` は Carbon の `reset` と `zone`（`cds--g10`）を出す。Tailwind の `theme` + `utilities` を後から読むと、Carbon の要素セレクタ（`button`、`h1` など）と Tailwind のユーティリティの詳細度・カスケード層（Tailwind v4 は `@layer` を使う。層の外にある Carbon の規則は層内の規則より**常に優先**される）が衝突する。共存期間中、移行済みの画面でも Carbon の reset が効き続ける点を前提にする必要がある。
2. **CSS の上限の余裕が未計測。** 22 kB に対する現在の Carbon CSS の実測が無い。PR 1（`ApprovalPanel`）は未マウントの画面なので、Carbon の CSS は減らず、Tailwind の固定費だけが乗る。
3. **E2E のセレクタが Carbon / CSS Modules の DOM に依存している**（R3.3 の 3 箇所: `[class*="toolOutput"]`、`role="status"`、`xpath=..`）。「テストを変えずに通す」と「`*.module.scss` を消す」を両立させるには、新しい DOM にフックを意図して残す必要がある。
4. **承認カードの入力が 2 系統で形が違う**（chat = `ToolUIPart`、jobs = `JobEvent`）。部品を 1 つにするなら中立の props と 2 つの写像が要る。2 つの部品に分けるなら R2.1 の「共通化」の範囲が縮む。
5. **停止理由がクライアントに無い。** 表示だけのはずの R2 が、chat route / agent の `messageMetadata` 変更（サーバ側）を引き込む可能性がある。
6. **Biome の CSS 解析。** [biome.json](../../biome.json) に `css` の設定が無い。Tailwind v4 の `@theme` / `@source` / `@custom-variant` / `@apply` を Biome が通すには `css.parser.tailwindDirectives: true` が要る（ベータ記録でも有効化した）。`mise run lint` が新しい CSS で落ちる。
7. **shadcn 部品と Biome の `recommended` ルール。** 写したソースが `noArrayIndexKey` や a11y 系のルールに当たる可能性がある。ベータ側では通ったが、ハブの Biome 2.5.15 の設定で再確認が要る。
8. **TS 6 の局所化と Dependabot。** `dependency-name` 単位の `ignore` はワークスペース全体に効く（R5.4）。
9. **R7 の Dependabot docker ブロックの分割。** `python >=3.14` ignore は 3 ディレクトリ共通。`services/api` だけを 3.14 にすると、同じ ignore が `services/api` の 3.14 系の更新を止め、外すと `services/agent` に 3.14 の PR が来る。
10. **複数 PR 間の文書のペア更新。** CLAUDE.md / AGENTS.md は R4.3・R5.4・R7.2 の 3 つの PR がそれぞれ触る。順序は独立（spec の依存表）なので、マージ順によって衝突する。

## 4. 実装アプローチの選択肢

### 4.1 UI 移行（R1〜R4）

| 案 | 内容 | 合う条件 | コスト | リスク |
|---|---|---|---|---|
| A. 既存の拡張（spec どおり） | R1 の土台 → R2 の部品 → `ApprovalPanel` → chat → 撤去、を 5 PR 直列で | 部品の形が chat と jobs で揃えられる場合 | 中 | 未マウントの `ApprovalPanel` を先にすると、PR 1〜2 の効果が E2E・バンドルで観測できない。部品の設計を実際の消費者（chat）抜きで決めることになる |
| B. 順序の入れ替え（chat 先行） | R1 → chat（承認カード・ツール表示・ストリーミングを chat で作る）→ `ApprovalPanel` → 撤去 | 部品の形を実際に描画される画面で決めたい場合 | 中 | R3.1 の順序の変更になる（spec の修正が要る）。chat は E2E のセレクタ依存が多く、1 本目の PR が重い |
| C. ハイブリッド（土台 + jobs のマウント先を先に作る） | R1 と同時に `ApprovalPanel` のマウント先（例: `/jobs/[id]`、または E2E 専用のハーネス）を用意し、A の順で進める | R2.6 の a11y E2E を `ApprovalPanel` でも満たしたい場合 | 中〜高 | 新しいページ（認証・存在秘匿の 404 の扱い）は表示層の外に出る。ハーネスなら本番の経路を増やさない |

いずれの案でも、承認カードを 1 部品にするか（中立 props + 2 写像）、chat 用と jobs 用の 2 部品にするかの選択が別にある。

### 4.2 TS 7（R5）

| 案 | 内容 | トレードオフ |
|---|---|---|
| A. ベータ記録の手順どおり（`packages/schemas` に TS 6 を閉じ込める） | R5.2 そのまま | 検証済みで最小。Dependabot の ignore の局所化が未解決（§3-8） |
| B. コード生成用の専用ワークスペースパッケージ（例: `tools/codegen`） | `@vaz/schemas` を runtime の契約パッケージのまま保つ | `pnpm-workspace.yaml` の `packages:` に新しいグロブが要る。Dependabot の問題は同じ |
| C. TS 7 を待つ（`openapi-typescript` の TS 7 対応まで据え置き） | R5 を延期 | 何も変えない。§8.1 の障害は残る |

### 4.3 Python（R6・R7）

- R6 は**新規実装がほぼ不要**で、記録と小さな修正（ストリームの `Error.message` の消費量、`ChatOutput` の docstring）だけになる見込み。1 PR にまとめられる。
- R7 は前提（サンドボックス spec `014` R1）待ち。先に進めるなら、ハブ側で 3.14 の `uv sync` + `api:check` を自分で流す（§8.2-1 の「ベータレーン側で記録する」の順序から外れる）選択肢もある。

## 5. plan フェーズで要調査の項目

| # | 調査 | 方法 | 関係 |
|---|---|---|---|
| Q1 | 現在の Client CSS / JS の実測（Carbon のみ） | `mise run build && mise run size` | R1.4、R3.5、R4.2 |
| Q2 | preflight なし（`tailwindcss/theme` + `tailwindcss/utilities`）での `source()` の書き方と固定費 | Tailwind v4 の docs（Context7）と試作 | R1.2、R1.3 |
| Q3 | Tailwind のエントリ CSS を `global.scss` と別ファイルにするか（Sass 経由で `@import "tailwindcss/…"` を通せるか）。Carbon の層外の規則と Tailwind の `@layer` の優先順位 | 試作 | R1.2、§3-1 |
| Q4 | AI SDK v7 の `useChat` でクライアントが `finishReason` を受け取れるか（`onFinish` の引数、UI message の metadata） | `node_modules/ai/docs/04-ai-sdk-ui/` | R2.1 停止理由、§3-5 |
| Q5 | Carbon の `text-area` スタイルが `text-input` / `form` に依存するか | `@carbon/styles/scss/components/text-area` の `@use` を読む | R3.4（PR 1 で `text-input` の 1 行を消せるか） |
| Q6 | Dependabot で、ワークスペースの 1 パッケージだけ TS を 6.x に留める方法（`directory: "/packages/schemas"` の別ブロックがルートのブロックと衝突しないか、`allow` / `ignore` の組み合わせ） | GitHub Docs（Dependabot options reference）を WebFetch | R5.4、§3-8 |
| Q7 | ハブのソースでの `apps/web` / `apps/worker` の `tsc --noEmit`、`test:e2e` を TS 7.0.x で流した結果。Next 16.3.8 での `next build` | ハブの worktree で試行（ベータ記録は Next 16.3.7・ベータのソース） | R5.5 |
| Q8 | pydantic-ai の docstring 解析が `Args` の `ctx` 行と `Returns:` 節をツール説明に含めるか。出力型（`NativeOutput` / `ToolOutput`）の class docstring がモデルに渡るか | Context7（pydantic-ai）と `FunctionModel` での確認 | R6.3 |
| Q9 | ストリームの `Error.message` に消費量（requests / tool_calls / total_tokens）を含めることの扱い | ハブのエラー方針と `services/api` の OWASP 対応表を確認 | R6.1 |
| Q10 | `ApprovalPanel.spec.tsx` を R3.2 の「変更せずに通す」対象に加えるか。`ApprovalPanel` を a11y E2E で覆うためのマウント先 | spec 改訂の判断 | R2.6、R3.2 |
| Q11 | IBM Plex（Akamai CDN）撤去後のフォント | `next/font` か system font かの判断 | R4.1 |

## 6. spec への反映（2026-10-03）

本分析の推奨に沿って [spec.md](./spec.md) を改訂した。

| 箇所 | 改訂 |
|---|---|
| 前提として確認した事実 | `ApprovalPanel` が未マウントであること、停止理由がクライアントに届いていないことを追加 |
| R2.1 | 承認カードは chat / jobs の両方から写像できる中立の props を受け、引数の表示・編集は入力にある場合だけ行う。停止理由はクライアントが既に持つ情報だけで表示し、サーバ側の metadata 追加は対象外（§3-4・§3-5） |
| R2.6 | a11y E2E の対象をマウント済みの画面の部品に限定。chat の承認カードは `page.route` のモックで検査。`ApprovalPanel` はマウント先を設ける別 spec へ持ち越し（Q10） |
| R3.2 | 「変更せずに通す」対象に `ApprovalPanel.spec.tsx` を追加 |
| R3.3 | E2E が依存する 3 つの DOM フック（`toolOutput` クラス、`role="status"`、ロール表示の親＝メッセージ枠）の維持を明記（§3-3） |
| R6.2 | 既存の fail-closed（502 `UPSTREAM_GROUNDING_FAILED`）を充足として記録する形に書き換え |
| R7.2 | 実体の無い `mise.toml`・`api.yml` を外し、Dockerfile・Ruff `target-version`・Dependabot docker ブロックの分割・各 AGENTS.md / steering を追加 |

未反映（plan で扱う）: R5.4 の Dependabot の局所化（Q6）、R6.1 のストリーム `Error.message` の消費量（Q9）、R6.3 の対象を出力型まで広げるか（Q8）。
