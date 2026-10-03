# 009-agent-ui-and-beta-intake

## Project Description

2026-10-03 のリポジトリ再評価で、Agentic AI 系の 4 リポジトリの役割が確定した
（[spec `008`](../008-hub-consolidation-followup/spec.md) の「ユーザ判断」節）。

| リポジトリ | 役割 |
|---|---|
| 本リポジトリ（`vaz-agentic-ai-next`） | 本番の統合ハブ。安定版チャネル |
| `next-agentic-stack` | TypeScript のベータ検証レーン |
| `pydantic-ai-sandbox` | Python のベータ検証レーンとパターン集 |
| `from-genai-to-agentic-ai` | 学習パス（19 モジュール） |

`fastapi-pydantic-ai-agent`・`pydantic-ai-agentic-patterns`・`agentic-ai-sandbox` はアーカイブ済み。

spec `008` はこの役割分担を明文化し、FastAPI レーンの正本（[ADR-0007](../../docs/adr/0007-fastapi-single-source-of-truth.md)）と
UI 部品の標準（[ADR-0008](../../docs/adr/0008-ui-component-standard.md)）を決めた。本 spec は、その方針に沿ってハブを実際に更新する。
対象は次の 3 系統。

1. **エージェント UI の移行。** ADR-0008 の Consequences が「別 spec で行う」とした Carbon → shadcn/ui + Tailwind CSS の移行
   （spec `008` tasks.md §6 の未完了項目）。
2. **TS ベータレーンからの取り込み。** `next-agentic-stack` が TypeScript 7 の据え置き理由
   （compiler API 依存ツール）について検証記録を残した。[`docs/dependency-policy.md`](../../docs/dependency-policy.md) §8.2 の手順で取り込む。
3. **Python ベータレーンからの取り込み。** `pydantic-ai-sandbox` の `docs/hub-intake-2026-10.md` のうち、
   H1・H2（slowapi 置き換え、#76）は取り込み済み。残る L1〜L4 と H3（Python 3.14）を扱う。

散文は日本語、識別子・型・パス・コードは英語。

### 前提として確認した事実（2026-10-03、`main`@`411b5b8`）

- Carbon を import しているのは `apps/web/src/features/chat/{Chat,ChatComposer,MessageItem}.tsx` と
  `apps/web/src/features/jobs/ApprovalPanel.tsx` の 4 ファイルと、
  [`global.scss`](../../apps/web/src/assets/styles/global.scss)（部品別の `@use` 15 行）だけである。
- `.size-limit.json` の上限は Client JS 420 kB / Client CSS 22 kB（brotli）。
- `next-agentic-stack` の検証では、shadcn/ui + Tailwind v4 は**ハブと同じ版**（Node 24 / Next 16.3.8 / TS 6.0.3）でも
  通り、preflight ありで CSS は 3.89 kB（brotli）だった。preflight とテーマ変数が約 2.2 kB を占める。
- TypeScript 7.0.2（安定版）で `next typegen` と `next build` の型検査は通る。`openapi-typescript` 7.13.0 は
  TS 7 では起動時に落ちるが、TS 6 を別のワークスペースパッケージに閉じ込めれば、生成物はコミット済みのものと
  バイト単位で同一になる（`next-agentic-stack` の `docs/beta-lane/2026-10-03-ts7-compiler-api.md`）。
- `hub-intake-2026-10.md` の L1（`UsageLimits` と全体タイムアウト）は、ハブ側に**既に存在する**。
  `services/api/app/api/v1/agent.py` は `UsageLimits` を付けた `run_guarded()` を `asyncio.wait_for(timeout=chat_request_timeout)` で囲み、
  超過時は 504 を返す。ストリーミング経路の `services/api/app/api/v1/_stream.py` も `UsageLimits` を付け、イベントごとに
  `sse_send_timeout` を掛けている。

---

## Requirements

既定の主語は THE VAZ platform。[E]=Event-driven / [U]=Ubiquitous / [S]=State-driven / [O]=Optional。

### Requirement 1: shadcn/ui + Tailwind CSS の導入（Carbon との共存期間）

1.1 [U] `apps/web` SHALL adopt Tailwind CSS v4 via `@tailwindcss/postcss` and shadcn/ui (`components.json`, new-york).
部品のソースはリポジトリへコピーする（shadcn の方式）。ベータレーンの設定ファイルは丸ごとコピーしない（§8.2-4）。
1.2 [S] WHILE any screen still imports `@carbon/react`, the global stylesheet SHALL load only
`tailwindcss/theme` and `tailwindcss/utilities`（preflight を読み込まない）。preflight は Carbon の reset と衝突するため、
最後の Carbon 画面を移した後（Requirement 4）に有効化する。
1.3 [U] Tailwind の走査対象 SHALL be limited to `apps/web/src`（`source(...)` 指定）。既定の自動検出は `docs/` や `specs/` の語まで
ユーティリティとして出力する（ベータレーンで 3.97 kB → 3.89 kB を実測）。
1.4 [U] 共存期間中も `.size-limit.json` の Client CSS 上限（22 kB）を SHALL NOT be raised。超える場合は移行の順序か範囲を見直す。
上限の変更は Requirement 4 の再測定でだけ行う。
1.5 [U] 新しい依存 SHALL be checked with `pnpm ignored-builds`。install スクリプトを持つものがあれば `pnpm-workspace.yaml` の
`allowBuilds` に記録する。`minimumReleaseAge`（24h）を満たさない版は採らない。
1.6 [U] `.github/dependabot.yml` SHALL group the UI dependencies（`radix-ui` / `class-variance-authority` / `clsx` /
`tailwind-merge` / `lucide-react`）。`tests/repo/dependabot.spec.ts` を合わせて更新する。
1.7 [U] 同じ画面に Carbon と shadcn/ui を SHALL NOT be mixed（ADR-0008 Consequences）。移行の単位は画面である。

### Requirement 2: HITL を含むエージェント UI 部品の共通化

2.1 [U] エージェント UI 部品 SHALL live under `apps/web/src/components/agent-ui/`。少なくとも次を含む。
- ツール実行の承認カード（ツール名・予定の引数・承認／却下／編集の操作）
- ツール呼び出しと結果の表示
- ストリーミング中のメッセージ表示と停止理由の表示
2.2 [U] 部品は表示に専念し、承認の判定・永続化・監査を SHALL NOT contain。判定は既存の
`apps/web/src/lib/approvals.ts`、監査は `recordApprovalDecisions` の単一発火点のまま変えない。
2.3 [U] 部品の props SHALL be typed from `@vaz/schemas` and the AI SDK v7 UI message part types。
画面固有の型を部品へ持ち込まない（兄弟リポジトリへコピーしたときに依存が切れないように）。
2.4 [U] 部品 SHALL never render raw tool arguments in logs or telemetry（R4.7 のプライバシー契約）。
画面に引数を表示するのは承認カードだけで、これは承認者が判断するために必要な表示である。
2.5 [U] 部品の正本は本リポジトリとする。`next-agentic-stack`（ベータ版ツールチェーンでの動作確認）と
`from-genai-to-agentic-ai`（M4 の承認ダイアログ）は、ここからソースをコピーして使う。
テーマトークン（色・コントラスト）は `from-genai-to-agentic-ai` の Tailwind v4 トークン設計を参照元にする（ADR-0008 Decision）。
2.6 [U] 各部品 SHALL have unit tests (jsdom) and SHALL be covered by the existing a11y E2E（`apps/web/tests/e2e/a11y.spec.ts`）。

### Requirement 3: 画面単位の移行（`ApprovalPanel` から）

3.1 [U] 移行の順序 SHALL be: (1) `features/jobs/ApprovalPanel.tsx`、(2) `features/chat/`（`Chat` / `ChatComposer` / `MessageItem`）。
1 画面につき 1 PR とする。
3.2 [U] `ApprovalPanel` の移行 SHALL NOT change the approval contract。次の E2E と単体テストを変更せずに通すこと。
- `apps/web/tests/e2e/approval-resume.spec.ts`、`hitl-approval.spec.ts`、`a11y.spec.ts`
- 承認ルートの 400 / 404 / 409 / 429 の挙動（存在秘匿の 404 の集約を含む）
3.3 [U] chat 画面の移行 SHALL keep `addToolApprovalResponse` ベースの承認／却下 UI の挙動（X-9）と
`locator-citation.spec.ts` の引用表示を保つ。
3.4 [E] WHEN a screen is migrated, its `*.module.scss` and the Carbon `@use` entries used only by that screen
SHALL be removed in the same PR。
3.5 [U] 各 PR SHALL record the measured `mise run size` result（JS / CSS、移行前後）in the PR body.

### Requirement 4: Carbon の撤去と規約の更新

4.1 [E] WHEN the last Carbon screen is migrated, `@carbon/react`・`@carbon/styles` とそれだけが使う依存（`sass` など）
SHALL be removed, and `global.scss` SHALL be replaced by the Tailwind entry stylesheet with preflight enabled.
4.2 [U] `.size-limit.json` の Client CSS 上限 SHALL be re-measured and lowered to the measured value plus headroom。
変更は計測値をコミットメッセージに書いたレビュー済みの変更として行う（AGENTS.md「Client bundle budget」）。
4.3 [U] `CLAUDE.md` / `AGENTS.md` の Carbon 規約（`"use client"` 必須、`global.scss` への部品別 `@use`、丸ごと import の禁止）
SHALL be removed **as a pair**, and replaced by the shadcn/ui rules（部品の置き場、`cn()`、preflight、走査範囲）。
規約の撤去は最後の画面を移した後に行い、それまでは有効のままとする（ADR-0008）。
4.4 [U] ADR-0008 の Status SHALL be updated to「移行完了」with the completion date.

### Requirement 5: TypeScript 7 の取り込み（TS ベータレーンの検証結果）

5.1 [U] 取り込み SHALL follow [`docs/dependency-policy.md`](../../docs/dependency-policy.md) §8.2 in one PR, linking the beta-lane record
（`next-agentic-stack` の `docs/beta-lane/2026-10-03-ts7-compiler-api.md`）.
5.2 [U] `openapi-typescript` と `typescript@6.0.3` SHALL move from the root to `packages/schemas` devDependencies,
and `mise run openapi:gen` SHALL invoke it via `pnpm --filter @vaz/schemas exec`。
5.3 [U] 再生成後に `git diff --exit-code packages/schemas/src/generated` SHALL pass（生成物が変わらないこと）。
5.4 [U] ルートの `typescript` SHALL be raised to the stable 7.x line（プレリリース版は入れない。§8.2-3）。
同じ PR で `.github/dependabot.yml` の `ignore`、`tests/repo/dependabot.spec.ts` の `HELD_BACK`、
`CLAUDE.md` / `AGENTS.md` の据え置き記述（ペア）、§8.1 の表の該当行を更新する。
`packages/schemas` の TS 6 は Dependabot の `ignore` で 6.x に留め、理由をコメントで残す。
5.5 [U] `mise run check`、`mise run build`、`mise run size`、`mise run test:e2e` SHALL pass under TS 7。
5.6 [E] WHEN `openapi-typescript` ships a release supporting TS 7, `packages/schemas` の TS 6 SHALL be removed
（`next-agentic-stack` の spec `001` が検知して記録する）。

### Requirement 6: Python ベータレーンの取り込み候補の残り（L1〜L4）

6.1 [U] L1（`UsageLimits` と全体タイムアウト）SHALL be recorded as already satisfied, citing `services/api/app/api/v1/agent.py`
and `services/api/app/api/v1/_stream.py`。上限超過の HTTP ステータスと本文の形が、レート制限の 429（`Retry-After` 付き）と
区別されていることを確認し、区別されていなければ別の `code` と 429 以外のステータスに直す（`hub-intake-2026-10.md` §3.2）。
6.2 [U] L2: RAG 応答の引用 SHALL be checked against the chunk IDs actually retrieved in the same request。
ベクトルストアの `query_with_scores()` が返す `RetrievedHit` の ID と照合していなければ、照合して集合外の引用を除去し、除去したことを記録する。
6.3 [U] L3: `services/api` のエージェントに登録されるツールの docstring SHALL contain only model-facing descriptions。
仕様書の節番号・テスト名などの開発者向けメモはコメントへ移す。監査結果を `services/api/docs/` に残す。
6.4 [U] L4: `Model.request()` を直接呼ぶ箇所 SHALL be listed。2026-10-03 時点では `services/api/app/api/health.py` の疎通確認
（ツールを渡さない意図的な呼び出し）だけであることを確認し、記録する。
6.5 [U] 6.1〜6.4 の結果 SHALL be reported back to `pydantic-ai-sandbox`（`docs/hub-intake-2026-10.md` の状態更新。同リポジトリの spec `014`）。

### Requirement 7: `services/api` の Python 3.14 への版上げ（H3）

7.1 [E] WHEN `pydantic-ai-sandbox` records that the hub's `services/api` dependency set passes `uv sync` and the test suite on Python 3.14
（同リポジトリの spec `014` Requirement 1）, `services/api` SHALL be raised to Python 3.14 in a dedicated PR。
7.2 [U] 同じ PR で `.python-version`・`mise.toml`・`test_python_version_pin.py`・CI（`api.yml`）・`services/api/CLAUDE.md` と
`AGENTS.md` のペア・[`docs/dependency-policy.md`](../../docs/dependency-policy.md) §8.1 の表を更新する。
7.3 [U] `mise run api:check` と `api:audit` SHALL pass on 3.14。`services/agent`（`py:check`）の版は本 Requirement の対象外で、
別途判断する。
7.4 [U] Python 3.15 SHALL NOT be adopted by this spec。`chromadb<1.0` → `onnxruntime` と `sentence-transformers` → `torch` に
cp315 の wheel が無い間は解決できない（再評価の条件は `pydantic-ai-sandbox` の spec `014` Requirement 3）。

## 依存関係と順序

| 順 | Requirement | 前提 |
|---|---|---|
| 1 | R1 → R2 → R3（`ApprovalPanel`）→ R3（chat）→ R4 | 直列。各 PR は前の PR のマージ後 |
| 2 | R5 | R1〜R4 と独立。§8.2-2 の「1 メジャー 1 PR」 |
| 3 | R6 | 独立 |
| 4 | R7 | `pydantic-ai-sandbox` の spec `014` R1 の検証記録 |

## Out of Scope

- `@types/node` の版上げ。Node のランタイムを上げる判断が先（§8.1）。根拠は `next-agentic-stack` の spec `001` で集める
- Next.js canary・TypeScript nightly などプレリリース版の採用（§8.2-3）
- Python 3.15（R7.4）
- `services/agent` の Python の版上げ
- 承認フローの契約・永続化・監査の変更（R2.2、R3.2）。本 spec は表示層だけを置き換える
