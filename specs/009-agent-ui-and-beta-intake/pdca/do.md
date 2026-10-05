# PDCA — Do フェーズ記録

Feature: `009-agent-ui-and-beta-intake`
Phase: §5 (tasks 5.1–5.4)
Completed: 2025-10-05

---

## 実施概要

Tailwind v4 / shadcn new-york 基盤と共通 agent UI コンポーネント（ApprovalCard、ToolExecution、StreamingStatus）を導入した。Carbon との共存期間中における cascade layer 契約を確立した。

---

## タスク別記録

### 1.1 — Tailwind v4 + cascade layer 契約

**RED → GREEN サイクル:**
- `apps/web/tests/e2e/css-cascade.spec.ts` に構造テストを追加（`@layer carbon` の存在、layer 順序の検査）
- RED 確認済み（Carbon 包みなしでテスト失敗）
- `global.scss` に `@use "sass:meta"` + `@layer carbon { @include meta.load-css(...) }` を追加して GREEN

**主な技術的判断:**
- `sass:meta` の `load-css()` を採用（第一候補）。`@forward` + `@use` での再 emit は `@use` の単一実行制約で不可
- Layer 順序宣言は `tailwind.css`（PostCSS パイプライン）に置く必要がある。`global.scss` では Sass が先に処理され PostCSS の `@layer` ステートメントより後に挿入されるため

**発生したエラーと対処:**
- `@source` に glob 拡張子 `{tsx,ts}` を使うと CSS 構文エラー → `source("../../**/*")` に変更
- `@layer carbon` 宣言場所: `global.scss` に書くと PostCSS merge 後に Tailwind の layer statement より後になる問題 → `tailwind.css` の先頭に移動

---

### 1.2 — shadcn primitives + cn()

**実装内容:**
- `apps/web/src/lib/utils.ts`: `clsx` + `tailwind-merge` による `cn()` utility
- `apps/web/src/components/ui/`: button.tsx, card.tsx, input.tsx, textarea.tsx, badge.tsx, alert.tsx
- shadcn からコピーした source として管理（独自振る舞いなし → unit test なし）
- `radix-ui/slot` の正しい import パス: `radix-ui/slot`（名前空間オブジェクト `radix-ui` ではない）

**発生したエラーと対処:**
- `import { Slot } from "radix-ui"` → Slot が undefined → `import { Slot } from "radix-ui/slot"` に修正

---

### 1.3 — Dependabot groups

**TDD サイクル:**
- `tests/repo/dependabot.spec.ts` に 4 テストを追加（shadcn-ui グループ、tailwind グループの所属・相互排他・cooldown・minimum-release-age 検査）
- RED 確認済み
- `.github/dependabot.yml` に `shadcn-ui` / `tailwind` グループを追加して GREEN

---

### 1.4 — ApprovalCard

**TDD サイクル (RED → GREEN → PROVE):**
- 15 テストを先に書いて RED 確認
- `ApprovalCard.tsx` を実装（Card + Badge + Button の shadcn primitives で構成）
- PROVE: `approved` / `denied` variant の state props を削除して各テストが失敗することを確認

---

### 1.5 — ToolExecution

**TDD サイクル:**
- 10 テストを先に書いて RED 確認
- `ToolExecution.tsx` を実装（ToolExecution 状態機械、approval slot、toolOutput CSS class の互換性維持）
- PROVE: `state` prop を "idle" に固定してツール名表示テストが失敗することを確認

---

### 1.6 — StreamingStatus

**TDD サイクル:**
- 13 テストを先に書いて RED 確認
- `StreamingStatus.tsx` を実装（aria-live region、状態優先順位: abort > error > streaming > completed）
- PROVE: `isAbort` 優先順位ロジックを削除して abort テストが失敗することを確認

---

### 1.7 — CSS budget gate

**TDD 追加:**
- `css-cascade.spec.ts` に behaviour test を追加: `padding`・`border-width`・`border-radius` が 0 でないことを検査
- PROVE: `@layer carbon { }` を削除すると Carbon の `padding: 0` reset が Tailwind utilities を上書きし、テストが失敗することを確認

**CSS サイズ削減の試行記録:**

| 試行 | 変更 | CSS サイズ | 結果 |
|------|------|-----------|------|
| baseline | 1.1 直後 (Carbon layer wrap のみ) | 20.9 kB | — |
| +shadcn primitives + theme import | @import "tailwindcss/theme" あり | 22.56 kB | 超過 |
| theme import 削除 | @import "tailwindcss/utilities" のみ | 22.36 kB | 超過 |
| transition-colors 除去 | button.tsx, badge.tsx, input.tsx | 22.16 kB | 超過 |
| @source not 追加 (API routes) | @source not "../../app/api/**/*.ts" | 22.16 kB | 変化なし |
| source() で scan root 固定 | source("../../**/*") | → filter/transform 除去 | — |
| @source not + source() 組み合わせ | ApprovalPanel も除外 | **21.9 kB** | **GREEN** |

**根本原因の特定:**
- `.filter` compat utility の誤生成: `ApprovalPanel.tsx` の `Array.prototype.filter()` 呼び出し
- `.transform` compat utility の誤生成: API route の `"no-transform"` 文字列
- `@source not` が機能しなかった原因: Tailwind v4 の oxide Scanner が negated pattern の base と positive pattern の base が異なると除外が効かない
- 解決策: `@import "tailwindcss/utilities" source("../../**/*")` で scan root を明示固定し、`@source not` の base を揃える

**最終サイズ: 21.9 kB brotli → Branch A 確定**

---

## 学習事項

1. **Tailwind v4 の @source not は scan root と同じ base が必要**: default の `**/*` scan（project root ベース）と `@source not`（CSS ファイルディレクトリベース）は base が異なるため除外が効かない。`source("...")` parameter で scan root を明示固定することで解決する。

2. **Tailwind v4 は JS コードも class candidate としてスキャンする**: `.filter()`、`"no-transform"` などの文字列から `.filter`、`.transform` utility が誤生成される。source exclusion で対処が必要。

3. **`@layer` 宣言の場所はパイプラインの処理順に依存する**: Sass → PostCSS の順で処理されるため、`global.scss` の `@layer` 宣言は PostCSS の出力より後になる。Tailwind の layer order 宣言は必ず `tailwind.css`（PostCSS ファイル）に置く。

4. **`sass:meta` の `load-css()` は Carbon layer 包みの唯一の実行可能な手法**: Sass の `@use` は module を一度だけ実行するため、`@use` + `@forward` で同じ module を `@layer carbon` ブロック内で再 emit することはできない。

5. **Tailwind v4 の `@theme` token は使用される utility を通じてのみ `:root` 変数として出力される**: 定義しても参照がなければ出力に含まれない。これにより `@layer properties` の `@property` 宣言が不要な変数分削減できる。

---

## §2 タスク別記録

Phase: §2 (tasks 2.1–2.2)
Completed: 2025-10-05

### 2.1 — ApprovalPanel を ApprovalCard へ接続

**TDD 方針:**
- 既存 `ApprovalPanel.spec.tsx`（10 テスト）を regression test として使用。Carbon 実装時に全 GREEN を確認してから移行。
- `ApprovalCard` の props に変更なし（既存 `labels`, `editableArguments`, `denialText`, `errorText` で要件を充足）。新規テスト不要。

**RED → GREEN サイクル:**
- `ApprovalPanel.tsx` の Carbon import を `ApprovalCard` に置き換え → 全 10 テスト GREEN を確認
- `global.scss` から `text-input` CSS entry を除去

**PROVE（非空虚性）:**
- `labels={{ deny: "拒否" }}` を `labels={{ deny: "BROKEN_LABEL" }}` に変更 → 2 テストが失敗
- 失敗メッセージ: `Unable to find an accessible element with the role "button" and name "拒否"`
- 元に戻してすべて GREEN を確認

**主な技術的判断:**
- `ApprovalCard.errorText` は buttons を非表示にする（`isTerminal` flag）ため、args validation error と submit error を ApprovalCard 外部の `<p>` 要素として表示する方式を採用
- `argsPlaceholderFor()` 関数は `ApprovalCard` の `Textarea` に placeholder prop がないため不要→削除（lint: `noUnusedVariables`）
- Import 順序 Biome 警告: `@/components/agent-ui/ApprovalCard` を react/schemas の後に配置して修正

**Carbon CSS 除去:**
- `text-input` のみ除去（`TextInput` は `ApprovalPanel` だけが使用）
- `tile`、`tag`、`form` は `MessageItem.tsx`・`ChatComposer.tsx` で使用中のため §3 まで保留

---

### 2.2 — 検証ゲート

**テスト結果:**
- `pnpm exec vitest run`: 79 files / 903 tests GREEN (1 skipped) ✓
- `pnpm -r run typecheck`: all packages GREEN ✓
- `pnpm exec biome check .`: lint GREEN ✓

**ビルド・サイズ:**
- `mise run build`: GREEN ✓
- `mise run size`:
  - Client JS: 384.2 kB brotli (上限 420 kB) ✓
  - Client CSS: 21.18 kB brotli (上限 22 kB) ✓
  - §1 の 21.9 kB から 0.72 kB 削減（text-input CSS 除去による）

**Branch A 継続確定:** CSS 22 kB 未超のため停止なし。


---

## §3 タスク別記録

Phase: §3 (tasks 3.1–3.3)
Completed: 2025-10-06

### 3.1 — Chat/ChatComposer shadcn/Tailwind 移行

**RED → GREEN サイクル:**
- `Chat.spec.tsx` に 11 件の新テストを追加（StreamingStatus integration × 6、composer shadcn migration × 3、streaming × 2 は既存）
- RED 確認済み: 6 件失敗（Carbon InlineLoading/InlineNotification が残存、role='status' が無い）
- `Chat.tsx` から Carbon `Theme`/`Content`/`Grid`/`Column`/`InlineLoading`/`InlineNotification`/`Button` を除去し、`StreamingStatus` + shadcn `Button` + Tailwind layout に移行
- `ChatComposer.tsx` から Carbon `Form`/`TextArea`/`Button` を除去し、native `<form>` + shadcn `Textarea`/`Button` + `<label htmlFor>` に移行
- 全 25 テスト GREEN

**技術的判断:**
- `useChat` status 型は `"streaming" | "submitted" | "error" | "ready"` — `"idle"` は存在しないため `status === "idle"` を除去
- エラー状態: `StreamingStatus` に `errorMessage={error?.message}` を渡し、`isError={status === "error"}` で error variant を表示
- 再試行ボタン: `status === "error"` の判定で条件 render（`StreamingStatus` の外側）

**PROVE:**
- `StreamingStatus` を除去 → `[role='status']` が null → "renders a live-region status element while submitted" 失敗確認
- `ChatComposer` に Carbon `Form` を戻す → `cds--form` class が現れる → "composer does not use Carbon Form" 失敗確認

---

### 3.2 — MessageItem → ApprovalCard + ToolExecution 移行

**RED → GREEN サイクル (Chat.spec.tsx への追加):**
- 6 件の新テスト追加: toolOutput class 維持、tool name 表示、Carbon Tag/Tile 非存在、role label、requestReason 表示
- RED 確認済み: 2 件失敗（Carbon Tag/Tile が残存）
- `MessageItem.tsx` から Carbon `Tile`/`Tag`/`Button` を除去し `ApprovalCard` + `ToolExecution` + Tailwind layout に移行
- 全 31 テスト GREEN

**AI SDK v7 対応 (ToolExecution.spec.tsx / ToolExecution.tsx への追加):**
- AI SDK v7 の tool part states が `ToolExecutionState` に含まれずに typecheck エラー
- `ToolExecution.spec.tsx` に 5 件の新テストを先に追加して RED → `ToolExecutionState` を拡張して GREEN
  - 追加 states: `"input-streaming"`, `"input-available"`, `"approval-responded"`, `"output-available"`, `"output-error"`, `"output-denied"`

**設計決定 — `ToolApprovalRequest` の実装方針:**
- 当初 `ToolExecution` を `ApprovalCard` の wrapper として使おうとしたが、tool name が 2 箇所に表示されてしまい、既存テスト `queryByText(/sendEmail/)` が "Found multiple elements" で失敗
- `ApprovalCard` を直接使い（`ToolExecution` wrapper なし）tool name を 1 箇所のみ表示するよう修正
- `displayArguments={part.approval.requestReason}` で requestReason を `<pre>` に表示 → `queryByText` で検索可能

**PROVE:**
- Carbon Tile を戻す → `[class*='cds--tile']` が現れる → "message container does not use Carbon Tile" 失敗確認
- `ToolExecutionState` から `"input-streaming"` を除去 → 対応テスト失敗確認

---

### 3.3 — E2E 基準固定・Carbon CSS 除去・最終ゲート

**追加ファイル:**
- `apps/web/tests/e2e/fixtures/approval-requested-stream.ts` — model-free AI SDK v7 stream fixture（HITL テスト用）
- `apps/web/tests/e2e/a11y.spec.ts` — chat approval a11y test を追加（error state via route mock）
- `apps/web/tests/e2e/css-cascade.spec.ts` — §3 chat element 計算済みスタイル検査を追加（message container、message list gap、composer padding）

**global.scss から除去した Carbon CSS entries:**
- `grid`, `tile`, `ui-shell/content`, `form`, `text-area`, `button`, `tag`, `inline-loading`, `notification`
- `Chat.module.scss` 削除（全インポート元がなくなったため）
- 残留 entries（`reset`, `zone`, `fonts`, `type`）は §4 で Carbon 完全撤去時に除去予定

**lint 修正:**
- `ToolExecution.tsx` の `hasResult` 算出式が 100 chars 上限を超過 → 改行して Biome フォーマット修正
- `approval-requested-stream.ts` のコメント内バックティックが Biome の JSDoc パースエラーを引き起こす → バックティックをエスケープ

**最終ゲート結果:**
- unit tests: 79 files / 923 tests GREEN (1 skipped)（+20 テスト from §1/§2/§3 baseline 903→923）
- typecheck: pass（全 packages）
- lint (Biome): pass（0 errors）
- `mise run build`: GREEN
- `mise run size`:
  - Client JS: **236.75 kB** brotli (上限 420 kB) ← §2 の 384.2 kB から 147.45 kB 削減 ✓
  - Client CSS: **6.61 kB** brotli (上限 22 kB) ← §2 の 21.18 kB から 14.57 kB 削減 ✓
- **Branch A 確定**（CSS 6.61 kB << 22 kB 上限）

**検証ゲート (`mise run check`) 最終結果:**
- test:run: 79 files / 923 tests GREEN (1 skipped) ✓
- typecheck: all packages pass ✓
- lint (Biome): 0 errors, no fixes applied ✓
- audit: No known vulnerabilities ✓
- lint:model-ids: No hardcoded model IDs ✓

---

## §4 タスク記録 (2025-10-05)

### 4.1 — Carbon 全撤去・Tailwind preflight 有効化

**TDD サイクル:**
- **RED**: `css-cascade.spec.ts` を更新し、`no @layer carbon block exists` テストが `Expected: false / Received: true` で失敗することを確認（Carbon がまだ存在する状態）
- **GREEN**:
  - `apps/web/src/assets/styles/global.scss` を削除
  - `apps/web/src/assets/styles/tailwind.css`: `@layer carbon, ...;` 除去、`@import "tailwindcss/utilities"` → `@import "tailwindcss"` (preflight 含む)
  - `apps/web/src/app/layout.tsx`: `global.scss` import 除去
  - `apps/web/next.config.ts`: `sassOptions` 除去
  - `apps/web/package.json`: `@carbon/react`・`@carbon/styles` 除去
  - `package.json` (root): `sass` devDependency 除去
  - `pnpm-workspace.yaml`: `@carbon/*`・`@ibm/plex*` allowBuilds entries 除去

**副次的修正:**
- `specs/009-agent-ui-and-beta-intake/gap-analysis.md` と `spec.md` の `global.scss` 向けリンクをコードスパンへ変換（doc-links.spec.ts の dangling link 修正）

**測定値:**
- Client CSS: **2.95 kB** brotli (§3 の 6.61 kB から 3.66 kB 削減)
- Client JS: **236.75 kB** brotli（変化なし）
- E2E: 9 tests GREEN (chromium, PORT=3001)

### 4.2 — 予算・文書更新

**CSS 上限計算:**
- measured = 2.95 kB
- ceil_0.1kB(2.95 + max(1.0, 2.95 × 0.10)) = ceil_0.1kB(3.95) = **4.0 kB**
- 4.0 kB < 22 kB → 引き下げ実施

**更新ファイル:**
- `.size-limit.json`: CSS limit `22 kB` → `4.0 kB`
- `AGENTS.md`: Carbon 規約 → shadcn/Tailwind 正式規約
- `CLAUDE.md`: VAZ stack 記述・Feature colocation・Carbon styles bullet を更新
- `.sdd/steering/tech.md`: UI Key Decisions 行を更新
- `README.md`: Tech Stack の UI components 行を更新
- `docs/adr/0008-ui-component-standard.md`: Status を「移行完了（2025-10-05）」に更新

**最終ゲート結果 (`mise run check`):**
- unit tests: 79 files / 923 tests GREEN (1 skipped) ✓
- typecheck: all packages pass ✓
- lint (Biome): 0 errors ✓
- audit: No known vulnerabilities ✓
- lint:model-ids: pass ✓
- `mise run build`: GREEN ✓
- `mise run size`: Client JS 236.75 kB / Client CSS 2.95 kB (新上限 4.0 kB) ✓
- E2E (css-cascade + a11y): 9 tests GREEN (chromium) ✓

---

## §5 タスク別記録 (TypeScript 7 採用と二層コンパイラ隔離)

### 5.1 — ADR-0009 起票と憲章 MINOR 改正

- `docs/adr/0009-typescript-7-adoption.md` を起票（根拠、二層構成、撤去条件）。
- `specs/009-agent-ui-and-beta-intake/reviews/ts7-constitution-r1.md` に MINOR 改正の承認記録を作成。
- `.sdd/memory/constitution.md` を v2.2.0 へ改正（Additional Constraints のツールチェーン記述更新、TODO(TYPESCRIPT_MAJOR) 解消、改訂履歴追記）。
- `tests/repo/doc-links.spec.ts` 3 passed 確認。

---

### 5.2 — openapi-typescript と TS 6.0.3 の @vaz/schemas 移設

- ルート `package.json` から `openapi-typescript` を削除。
- `packages/schemas/package.json` の devDependencies に `openapi-typescript: ^7.13.0` と `typescript: 6.0.3` を追加。
- `mise.toml` の `openapi:gen` タスクを `pnpm --filter @vaz/schemas exec openapi-typescript src/generated/...` へ更新。
- `mise run openapi:gen` 実行確認。

---

### 5.3 — Dependabot Fallback hold & root TS 7 昇格 & Repo Guard 更新

- `dependabot-cli` コマンドが環境に無いため、plan.md DES-1.8 に基づき Fallback hold（`dependency-name: "typescript"`、versions/update-types なし）を採用。
- `tests/repo/dependabot.spec.ts` に Fallback hold と root TS 7 / schemas TS 6 の専用アサーションを追加。
- PROVE: ルート TS が 6.0.3 の状態でテストを実行し、`Expected: /^[~^]?7\./, Received: "^6.0.3"` で RED を確認。
- ルート `package.json` の `typescript` を `^7.0.0`（実解決 7.0.2）へ昇格、`.github/dependabot.yml` を更新して GREEN。
- `packages/evals/package.json` の standalone `tsc` typecheck を検証（GREEN）。
- `AGENTS.md`, `CLAUDE.md`, `.sdd/steering/tech.md`, `README.md`, `docs/dependency-policy.md` §8 を同期。

---

### 5.4 — 契約同一性 (Byte-identity) と TS 7 Verification Gate

- `mise run openapi:gen` 実行後の生成物 `packages/schemas/src/generated/*.ts` に差分がないこと（byte-identical）を確認。
- `mise run check`（Biome + Typecheck + Vitest + Audit + Model-ID check）全緑。
- `mise run build`（Next.js Turbopack build）完了。
- `mise run size`（Client JS 236.75 kB / CSS 2.95 kB）全緑。
- Playwright E2E（`css-cascade.spec.ts`, `a11y.spec.ts`）9 passed。

---

## §6 タスク別記録 (Python ベータレーン L1〜L4 の証跡取り込み)

Phase: §6 (tasks 6.1–6.3)
Completed: 2025-10-06

### 6.1 — L1/L2 監査と証跡記録

- `services/api/docs/python-beta-intake-2026-10.md` に L1 (`UsageLimits` + timeout 504 / 200 budget_exceeded / 429 rate limit) と L2 (`RetrievedHit` citation fail-closed / dangling 502) の充足状況を文書化。
- 既存の timeout, rate limit, citation テストが適切に分離されていることを確認（コード修正不要）。

### 6.2 — L3 description/schema 監査と検査テスト

- `ChatOutput` の class docstring に含まれていた開発者用参照（`"Req 10.2"`）を内部コメントへ移動。
- `services/api/tests/unit/agents/test_chat_output_description.py` を追加（3 件の検査テスト: FunctionModel 経由の NativeOutput schema 検査、docstring 検査、field description 検査）。
- `test_tools_mock.py` の `TestMockToolDescriptionSentToModel` と合わせてモデル向け schema/description に開発者コメントが含まれないことを保証。

### 6.3 — L4 `Model.request()` inventory test と証跡更新

- `services/api/tests/unit/test_model_request_inventory.py` を追加（AST walk で `services/api/app` 内の direct `model.request()` を検出し、`app/api/health.py::_probe_llm_provider` 以外の呼び出しを禁止）。
- `services/api/docs/python-beta-intake-2026-10.md` の L4 証跡を記録。
- `mise run api:check`（ruff, ty, pytest 1630 passed）が全緑であることを確認。
