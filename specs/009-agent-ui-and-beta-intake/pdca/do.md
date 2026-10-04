# PDCA — Do フェーズ記録

Feature: `009-agent-ui-and-beta-intake`
Phase: §1 (tasks 1.1–1.7)
Completed: 2025-10-04

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
