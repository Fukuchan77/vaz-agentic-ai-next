# 007-cross-repo-adoption-closeout — PDCA Do Phase

## Task 3: Agentic 側対応表を 15 脅威全件へリネーム・改訂する（2026-09-22）

### 実施内容

**3.1 — `git mv` リネーム ＋ 参照更新（6 ファイル）**

- `git mv docs/owasp-agentic-ai-top10-mapping.md docs/owasp-agentic-threats-mitigations-mapping.md`
- `CLAUDE.md:7`（リンク）、`docs/owasp-llm-top10-mapping.md:12`（リンク・相互参照）、
  `docs/cross-repo-adoption-backlog.md:139`（リンク）、`docs/cross-repo-adoption-backlog.md:152`（コードスパン）、
  `docs/cross-repo-adoption-review.md:727`（リンク・追記のみ文書、リンク先のみ是正）、
  `specs/review/2026-09-22-cross-repo-verification.md:94`（リンク・時点の記録、同様に是正）
  `specs/007-cross-repo-adoption-closeout/gap-analysis.md`（リンク）
- `doc-links.spec.ts` / `cross-repo-reference-resolution.spec.ts` ともに GREEN を確認

**3.2〜3.4 — 文書全面改訂（tasks 3.2/3.3/3.4 を一括実施）**

全面書き直しの理由: 構造（語彙定義 / 索引表 / 節構造）が相互に依存しており、
増分では `parseSections` / `parseThreatIndex` ガードの誤検知が生じるためまとめて実施。

設計上の罠として 2 点を記録する（tasks.md Implementation Notes にも記載）:

1. **`##` vs `###` ヘッダの使い分け**: `parseSections` はレベル 2 見出し（`## `）のみを
   脅威節として認識する。語彙定義と索引表を `## ` にすると、これらも脅威節として扱われ
   「`- 状態:` が 0 行 → exactly-1 チェックに失敗」となる。`### ` にして解決。

2. **`parseThreatIndex` のテーブル検索ロジック**: 最初に見つかったテーブルの最初の非 `|` 行で
   `break`（ループ終了）する。語彙定義をMarkdown テーブルとして `## ` の下に置くと、
   そちらが先に見つかり脅威索引テーブルに到達しない。バレット形式に変更して回避。

**3.5 — T-ID 補助列の実測**

OWASP *Agentic AI – Threats and Mitigations* v1.0 の文書構造（T1 から T15 の順序）に基づき
T-ID を埋めた。ガードの判定は脅威名列（主キー）のみを使用するため（ADR-2）、
T-ID 列は参照用補助情報として扱う。

### PROVE 証拠（guard の非空虚性）

ガード（`owasp-mapping-citations.spec.ts`）が Agentic 文書に対して全テストを通過:

```
✓ exactly 2 mapping documents are declared (anti-false-green)
✓ document exists: docs/owasp-agentic-threats-mitigations-mapping.md (R4.7)
✓ Agentic document contains at least 1 structured citation (non-empty scan guard)
✓ Agentic document has at least 1 status token (non-empty status scan guard)
✓ Agentic document threat index has exactly 15 rows (R1.6 pre-assertion)
✓ all path citations in docs/owasp-agentic-threats-mitigations-mapping.md exist
✓ all symbol citations in docs/owasp-agentic-threats-mitigations-mapping.md are resolvable
✓ all CI citations in docs/owasp-agentic-threats-mitigations-mapping.md are valid
✓ all status tokens in docs/owasp-agentic-threats-mitigations-mapping.md are valid
✓ status-line count in docs/owasp-agentic-threats-mitigations-mapping.md is exactly 1 per section
✓ all accepted sections in docs/owasp-agentic-threats-mitigations-mapping.md have re-evaluation triggers
✓ docs/owasp-agentic-threats-mitigations-mapping.md preamble contains an ISO-8601 taxonomy version date
✓ index has 15 rows and all point to existing section headings
✓ every threat section is listed in the index exactly once
```

残る 4 件失敗はすべて `docs/owasp-llm-top10-mapping.md` に関するもので、Task 4 のスコープ（Task 2 が
ガードを書いた時点から予期されていた未着状態）。

### 現在の状態

- `docs/owasp-agentic-threats-mitigations-mapping.md`: 15 脅威 15 節、3 値語彙、再評価トリガ、索引表、版日付 ✓
- `docs/owasp-agentic-ai-top10-mapping.md`: `git mv` で削除済み ✓
- 参照更新 6 ファイル: 全件 `doc-links.spec.ts` GREEN ✓
- `tests/repo/repo` プロジェクト: 41/45 GREEN（残り 4 は LLM 文書 = Task 4 スコープ）✓

---

## Task 4: LLM 側対応表を 3 値語彙・版日付・構造化引用へ移行する（2026-09-22）

### 実施内容

**4.1 — 冒頭ブロック追加**

- `docs/owasp-llm-top10-mapping.md` の先頭に出所タクソノミ名（OWASP Top 10 for LLM Applications 2025）と
  版日付 `2024-11-17`（ISO-8601）を追記。Agentic 文書と同一文言の語彙定義ブロック（3 値の意味 ＋
  再評価トリガ義務）を `### 状態トークン語彙定義` として追加。

**4.2 — 全節を構造化引用ブロックへ移行**

全 10 節（LLM01〜LLM10）を IF-3 の 5 キー形式（`- 状態:` / `- 実装:` / `- テスト:` / `- CI:` / `- 再評価トリガ:`）へ
書き直し、各節に `- 状態:` を 1 行だけ付与した。旧形式のインライン実装リストと
`- テスト: なし——**未対応**` キーを廃止。`- CI:` にあったシェルコマンド（`pnpm audit --audit-level=moderate`）
は散文へ移し、`- CI:` にはワークフローファイルパスとステップ名のコードスパンのみを置いた。

**4.3 — 未対応 2 クレームの再分類と細部是正**

- **LLM05**: `grep -rn dangerouslySetInnerHTML apps/web/src` がシンボル扱いになりガードを破っていたため、
  散文中の説明に移動。状態を `Partial · accepted`（React の XSS 防止に依存するが専用テストなし）へ再分類。
  再評価トリガ: `dangerouslySetInnerHTML` や `eval()` を使う UI コンポーネントを追加したとき。
- **LLM07**: `テスト: なし——**未対応**` を `Accepted`（秘密情報を含まない設計だが能動的防御なし）へ再分類。
  再評価トリガ: system prompt に秘密情報を含めるようになったとき。
- **LLM03**: 「全 6 ワークフロー」を「全 7 ワークフロー」に是正（実測 7 本: lint/tests/eval-nightly/eval-pr/security-daily/api/python）。
- 相互参照: LLM 文書から Agentic 文書への参照は Task 3.1 で既に新ファイル名
  `docs/owasp-agentic-threats-mitigations-mapping.md` に更新済み。双方向を確認。

**設計上の罠（1 点）**

シンボルアノテーション（`（`symbolName`）`）を `- テスト:` キー行に置くと、ガードは
その行のパス群（テストファイル）に当該シンボルが実在するかを検査する。
`isApprovalCapable` / `buildBudgetStopCondition` は実装ファイルにのみ定義されテストファイルには
出現しないため、`- テスト:` 行からアノテーションを除去して `- 実装:` 行のみに残した。
`assertAllowedRecipient` / `resolveVazRole` はテストファイル本文に登場するため維持した。

### PROVE 証拠（guard の非空虚性）

ガード（`owasp-mapping-citations.spec.ts`）が 2 文書に対して全 24 テストを通過:

```
✓ exactly 2 mapping documents are declared (anti-false-green)
✓ document exists: docs/owasp-agentic-threats-mitigations-mapping.md (R4.7)
✓ document exists: docs/owasp-llm-top10-mapping.md (R4.7)
✓ Agentic document contains at least 1 structured citation (non-empty scan guard)
✓ LLM document contains at least 1 structured citation (non-empty scan guard)
✓ Agentic document has at least 1 status token (non-empty status scan guard)
✓ LLM document has at least 1 status token (non-empty status scan guard)
✓ Agentic document threat index has exactly 15 rows (R1.6 pre-assertion)
✓ all path citations in docs/owasp-agentic-threats-mitigations-mapping.md exist
✓ all path citations in docs/owasp-llm-top10-mapping.md exist
✓ all symbol citations in docs/owasp-agentic-threats-mitigations-mapping.md are resolvable
✓ all symbol citations in docs/owasp-llm-top10-mapping.md are resolvable
✓ all CI citations in docs/owasp-agentic-threats-mitigations-mapping.md are valid
✓ all CI citations in docs/owasp-llm-top10-mapping.md are valid
✓ all status tokens in docs/owasp-agentic-threats-mitigations-mapping.md are valid
✓ all status tokens in docs/owasp-llm-top10-mapping.md are valid
✓ status-line count in docs/owasp-agentic-threats-mitigations-mapping.md is exactly 1 per section
✓ status-line count in docs/owasp-llm-top10-mapping.md is exactly 1 per section
✓ all accepted sections in docs/owasp-agentic-threats-mitigations-mapping.md have re-evaluation triggers
✓ all accepted sections in docs/owasp-llm-top10-mapping.md have re-evaluation triggers
✓ docs/owasp-agentic-threats-mitigations-mapping.md preamble contains an ISO-8601 taxonomy version date
✓ docs/owasp-llm-top10-mapping.md preamble contains an ISO-8601 taxonomy version date
✓ index has 15 rows and all point to existing section headings
✓ every threat section is listed in the index exactly once
```

### Verification Gate

```
mise run check  →  lint ✓ | audit ✓ | typecheck ✓ | test:run 686 passed / 1 skipped ✓
```

`repo` プロジェクト: 45/45 ✓（Task 3 の時点から 4 件 → 0 件へ）

### Implementation Notes（tasks.md へのミラー）

- シンボルアノテーションは **実装ファイル名を挙げた `- 実装:` キー行にのみ**置く。
  テストファイルで当該シンボルを import・使用していない場合は `- テスト:` 行から除去する。
- `- CI:` 行の第 1 コードスパン = ワークフローファイル、以降 = そのワークフロー内の `name:` 値。
  ガードは `yaml.parse` で構造的に検証するため、ステップ名の表記は YAML `name:` と完全一致が必要。

---

## Task 5: 承認の wire 契約と予算 env（2026-09-22）

### 実施内容

**5.1 — 単一形・セット形のテスト先行作成**

- [`packages/schemas/tests/workflows.spec.ts`](../../../packages/schemas/tests/workflows.spec.ts) にテストを追加。
- UUID `toolCallId`、`decision: "approve" | "reject"`、任意 `args` を持つ単一形と、`min(1)` のセット形 `{ decisions: [...] }` の受理を検証。
- 余剰・禁止フィールド（`history`, `messages`, `usage`, `model`, `prompt`, `extraField`）が単一形・セット形の双方および union (`approvalRequestSchema`) で確実に **reject** されることをテスト（D1 の「証明」）。

**5.2 — `approvalDecisionSchema` / `approvalDecisionSetSchema` / `approvalRequestSchema` 実装**

- [`packages/schemas/src/workflows.ts`](../../../packages/schemas/src/workflows.ts) に `approvalDecisionSchema`（`z.strictObject`）、`approvalDecisionSetSchema`（`z.strictObject`）、`approvalRequestSchema`（`z.union`）を実装。
- `ApprovalDecision`, `ApprovalDecisionSet`, `ApprovalRequest` 型（`z.infer`）を export。

**5.3 — `JOB_TOKEN_BUDGET` の env 定義とテスト**

- [`packages/schemas/tests/env.spec.ts`](../../../packages/schemas/tests/env.spec.ts) に既定値 (200,000)、文字列 coerce、空文字フォールバック、非正数/非整数 reject のテストを作成。
- [`packages/schemas/src/env.ts`](../../../packages/schemas/src/env.ts) の `aiEnvSchema` および `parseAiEnv` に `JOB_TOKEN_BUDGET` を `CHAT_TOKEN_BUDGET` と同型で追加。
- [`.env.example`](../../../.env.example) に `JOB_TOKEN_BUDGET=200000` を追記。

### PROVE 証拠

1. **`approvalDecisionSchema` strictObject の非空虚性**: `z.strictObject` を `z.object` に意図的に書き換えると、`rejects excess / forbidden fields in single decision` テストが期待通り `expected true to be false` で FAIL することを確認。
2. **`JOB_TOKEN_BUDGET` positive/int 制約の非空虚性**: `.int().positive()` を外すと `rejects a non-positive value` / `rejects a non-integer value` が FAIL することを確認。

### Verification Gate

```
mise run check  →  lint ✓ | audit ✓ | typecheck ✓ | test:run 702 passed / 1 skipped ✓
```

---

## Task 6: `job_step` テーブルと migration（2026-09-22）

### 実施内容

**6.1 — `packages/db/tests/schema.spec.ts` へのテスト先行作成**

- [`packages/db/tests/schema.spec.ts`](../../../packages/db/tests/schema.spec.ts) に `job_step` テーブル、`approvalStateEnum`、`jobStepInsertSchema` / `jobStepSelectSchema`、複合主キー `(job_id, step_id)`、および FK cascade のテストを追加。
- 意図通り RED（未定義エラー）となることを確認。

**6.2 — `packages/db/src/schema.ts` へのスキーマ追加**

- [`packages/db/src/schema.ts`](../../../packages/db/src/schema.ts) に `approvalStateEnum` (`"pending"`, `"consumed"`)、`jobStep` テーブル（複合 PK `(jobId, stepId)`、FK `jobId` → `job.id` ON DELETE cascade、`totalTokens` NOT NULL DEFAULT 0）、および drizzle-zod の `jobStepInsertSchema` / `jobStepSelectSchema` を実装。
- 既存の 6 テーブル（`document`, `chunk`, `embedding`, `job`, `jobEvent`, `auditLog`）および `jobEventTypeEnum` に変更を加えないことを保証。

**6.3 — `0002_add_job_step.sql` 手書き SQL 作成と DDL ドリフト検査**

- [`packages/db/drizzle/0002_add_job_step.sql`](../../../packages/db/drizzle/0002_add_job_step.sql) を作成し、`approval_state` ENUM と `job_step` テーブル（FK cascade、複合 PK）の DDL を定義。
- [`packages/db/tests/schema-ddl.spec.ts`](../../../packages/db/tests/schema-ddl.spec.ts) に `jobStep` / `approvalStateEnum` をインポート・登録し、テーブルパーサーに `CONSTRAINT ... PRIMARY KEY` のサポートを追加。
- DDL ドリフト検査および既存のマイグレーション順序検査を GREEN に導いた。

### PROVE 証拠

1. **`approvalStateEnum` 順序チェックの非空虚性**: `approvalStateEnum` の定義値を意図的に `["consumed", "pending"]` に反転させると、`schema.spec.ts` および `schema-ddl.spec.ts` の双方が `expected [ 'consumed', 'pending' ] to deeply equal [ 'pending', 'consumed' ]` で FAIL することを確認。
2. **`schema-ddl.spec.ts` ドリフト検知の非空虚性**: `0002_add_job_step.sql` と `schema.ts` 間の enum 順序不整合を確実に検知して FAIL することを確認。

### Verification Gate

```
pnpm exec vitest run  →  66 test files passed, 710 passed / 1 skipped
pnpm exec biome check .  →  Checked 164 files in 63ms. No fixes applied.
pnpm -r run typecheck  →  All packages typechecked successfully.
bash scripts/forbid-model-ids.sh  →  No hardcoded model IDs found.
```

---

## Task 7: `JobStepStore` port（C-9 ストア部）（2026-09-23）

### 実施内容

**7.1 — `apps/worker/tests/stores-job-step.spec.ts` 新規作成（テスト先行）**

- 3 つの describe ブロックに 11 テストを作成。すべて `createJobStepStore is not a function` で RED であることを確認してから実装へ進んだ。
- `fakeInsertDb`: INSERT-path 専用フェイク。`onConflictDoNothing` / `onConflictDoUpdateSet` の両フラグをレコードに持ち、呼び出し後に検査可能。
- `fakeTransactionDb`: `db.transaction(fn)` を捉えて制御された tx オブジェクト（select / update チェーン）を供給。UPDATE の `setConsumedAt` / `setApprovalState` を後から検査できる。
- `registerPending`: `onConflictDoNothing: true` かつ `onConflictDoUpdateSet: null` を両立することをアサート。
- `recordStepUsage`: `onConflictDoUpdateSet: { totalTokens }` で絶対値 SET かつ `onConflictDoNothing: false` をアサート。
- `claimPending`: 1 transaction コール、`consumed_at = AT`（注入値）、`approvalState = 'consumed'`、戻り値 = rowCount (0 / 1 / 3) の 5 ケース。

**7.2 — `apps/worker/src/stores.ts` へ実装**

- `jobStep` / `and` / `sql` を import に追加。
- `JobStepStore` interface と `createJobStepStore` factory を `JobStore` の直前に配置。
- `registerPending`: `db.insert(jobStep).values({...}).onConflictDoNothing()`
- `recordStepUsage`: `db.insert(jobStep).values({...}).onConflictDoUpdate({ target: [jobStep.jobId, jobStep.stepId], set: { totalTokens } })`
- `claimPending`: `db.transaction` 内で select（sum）→ update（WHERE pending）→ `rowCount ?? 0` 返却。`consumed` → `pending` 逆向き API は意図的に提供しない。

### PROVE 証拠（非空虚性）

全 11 テストが実装前に `TypeError: createJobStepStore is not a function` で FAIL:

```
FAIL  worker  tests/stores-job-step.spec.ts
  createJobStepStore.registerPending …
  × inserts into the job_step table with approval_state = 'pending'
  × uses ON CONFLICT DO NOTHING …
  × does NOT use onConflictDoUpdate …
  createJobStepStore.recordStepUsage …
  × inserts into the job_step table with the supplied totalTokens
  × uses onConflictDoUpdate to SET total_tokens …
  × does NOT use onConflictDoNothing …
  createJobStepStore.claimPending …
  × runs inside a single transaction
  × sets consumed_at to the injected at timestamp …
  × sets approval_state to 'consumed' on the updated rows
  × returns the number of rows updated …
  × returns 0 when no pending rows exist …
  Tests  11 failed (11)
```

実装後に全 11 GREEN:

```
✓ worker  tests/stores-job-step.spec.ts (11 tests)  6ms
```

### Verification Gate

```
pnpm exec vitest run --project worker
  Test Files  9 passed (9)
  Tests       83 passed (83)

mise run lint
  Checked 165 files in 66ms. No fixes applied.

mise run typecheck
  apps/worker typecheck: Done (tsc --noEmit, 0 errors)
  apps/web typecheck: Done
```

Worker test count delta: 72 → 83（+11 新規テスト、全件 stores-job-step.spec.ts）

---

## Task 8: worker 側で pending set と観測 usage をミラーする（C-11）（2026-09-23）

### 実施内容

**8.1 — `apps/worker/tests/main.spec.ts` へのテスト先行作成（RED）**

- `describe("WorkerApprovalMirror")` ブロックに 8 テスト、`describe("submitApproval — idempotency")` ブロックに 1 テストを追加（計 9 テスト）。
- INV-1 順序アサート: `callOrder` 配列で `registerPending → approvalGate` の順序を記録し、`expect(callOrder).toEqual(["registerPending", "approvalGate"])` で検証。
- I-2 再実行トラップ: 同一 `stepId` で `runner.run()` を 2 度呼ぶと `registerPending` が 2 度呼ばれることを確認（main.ts に条件分岐を持ち込まないことの証明）。
- `recordStepUsage`: `document-generation` specialist が `usage: { totalTokens: 150 }` を返すと `recordStepUsage(JOB_ID, STEP_ID, 150)` が呼ばれることを確認。
- `jobStepStore` 未注入時の no-op: `requiresApproval: () => true` でもエラーなく完了。
- `submitApproval` 冪等化: `sent[0].id === "<jobId>:<stepId>"` を検証。
- 5 テストが RED（残り 4 はすでに no-op 動作が正しい）であることを確認。

**8.2 — `apps/worker/src/main.ts` 実装（GREEN）**

- `import type { JobStepStore, JobStore }` を更新。
- `CreateDurableStepRunnerOptions` に `jobStepStore?: JobStepStore` と `now?: () => Date` を追加（ドックコメント付き）。
- `createDurableStepRunner.run()`: `requiresApproval(stepId)` が真のとき、`approvalGate` await の直前に `await jobStepStore?.registerPending(jobId, stepId, now?.() ?? new Date())` を呼ぶ（INV-1 確保）。
- `instrumentEmit` のシグネチャに `jobStepStore?: JobStepStore` を追加。`completion` イベントで `event.stepId` が存在し `event.result.usage.totalTokens` が `number` のとき `jobStepStore.recordStepUsage(jobId, event.stepId, totalTokens)` を呼ぶ（構造的アクセス、Zod 再パースなし）。
- `RunJobOptions` に `jobStepStore?: JobStepStore` を追加。`runJob` 内で `jobStepStore` を destructure し、`instrumentEmit` と `createDurableStepRunner` の双方へ渡す（`now: deps.now`）。

**8.3 — `submitApproval` 冪等化 ＋ `start.ts` 配線**

- `submitApproval` の `engine.send` に `id: \`${signal.jobId}:${signal.stepId}\`` を追加（`submitJob` と対称）。
- `apps/worker/src/start.ts`: `createJobStepStore` import 追加、`registerJobFunction` オプションに `jobStepStore: createJobStepStore(db)` を注入。
- 既存テスト（`durability.spec.ts`・`start.spec.ts`）が新シグネチャの変更を反映するよう更新（VDD トリガ #3: 既存テスト修正 → 正当。変更は「送信された id フィールドを期待に追加」と「stores モックに `createJobStepStore` を追加し `options.jobStepStore` のアサートを追加」の 2 点のみ）。

### PROVE 証拠（非空虚性）

以下の 3 点を意図的に破り、対応するテストが FAIL することを確認:

1. **INV-1 順序**: `registerPending` と `approvalGate` の呼び出し順序を入れ替えると  
   `AssertionError: expected [ 'approvalGate', 'registerPending' ] to deeply equal [ 'registerPending', 'approvalGate' ]`

2. **`recordStepUsage` コールブロックをコメントアウト**: usage 付き completion が来ても `recordStepUsage` が呼ばれず  
   `AssertionError: expected [] to have a length of 1 but got +0`

3. **`submitApproval` から `id` フィールドを削除**: idempotency テストが  
   `AssertionError: expected undefined to be '11111111...:22222222...'`

### Verification Gate

```
pnpm exec vitest run --project worker
  Test Files  9 passed (9)
  Tests       91 passed (91)

mise run check
  lint ✓ | audit ✓ | typecheck ✓ | test:run  729 passed / 1 skipped ✓
```

Worker test count delta: 83 → 91（+8 新規テスト: 7 x WorkerApprovalMirror + 1 x submitApproval idempotency。既存 2 テストは新シグネチャ対応で修正）。

---

## Task 9: 承認決定ロジック（C-8）（2026-09-23）

### 実施内容

**9.1 — `apps/web/tests/approvals.spec.ts` 新規作成（テスト先行）**

35 テストを 6 describe ブロックに作成し、実装前に全件 RED であることを確認してから実装へ進んだ。

主要ケース:
- `normalizeApprovalRequest`: 単一形→1要素配列への畳み込み、`submittedAs` の保持、args の透過
- `findDuplicateTarget`: 空・単一・重複あり・重複なし
- `maskedArgKeys`: 値を含まないキー名のみ返却、undefined/null/string/空オブジェクト
- `resolveJobTokenBudget`: 既定値・coerce・正数制約（0/-1 で throw）
- `claimApprovalTargets`: claimed/not-claimable/budget-exceeded の 8 ケース
- `recordApprovalDecisions`: tool名・maskedArgs・callerId/jobId・fail-soft・R4.7

**9.2〜9.4 — `apps/web/src/lib/approvals.ts` 実装**

- `normalizeApprovalRequest`: 単一形を `{ decisions: [d], submittedAs: "single" }` へ正規化
- `findDuplicateTarget`: Set による O(n) 重複検出（DB 接触前）
- `maskedArgKeys`: `typeof args === "object"` チェック付き `Object.keys()`（配列・null 除外）
- `resolveJobTokenBudget`: `parseAiEnv(env).JOB_TOKEN_BUDGET` に委譲（DRY / C-10）
- `ClaimOutcome`: 3 バリアント（`claimed` / `not-claimable` / `budget-exceeded`）の判別可能 union
- `claimApprovalTargets`: `claimPending` 1 コール → rowCount=0 で `not-claimable`、totalTokens≥budget で `budget-exceeded`（行は消費済み）、それ以外で `claimed`
- `recordApprovalDecisions`: `for` ループで各 decision を `try/catch` で包み、失敗時は `logger.error` に `{ jobId, stepId, error.message }` のみ出力して継続（fail-soft）

**`JobStepStore.claimPending` 戻り値の拡張（Task 7 port への最小変更）**

`Promise<number>` → `Promise<{ rowCount: number; totalTokens: number }>` に変更。
トランザクション内で `await` していた `sum` SELECT の結果を捨てていたのを戻り値に追加。
影響範囲: `stores-job-step.spec.ts`（4 テスト更新 + 2 テスト追加）、`main.spec.ts`（2 インライン fake 更新）。

### PROVE 証拠（非空虚性）

**実装前 RED 確認（全 35 テスト）**:

```
RUN  v4.1.11
FAIL  web  tests/approvals.spec.ts
  Cannot find module '@/lib/approvals' from 'tests/approvals.spec.ts'
  Tests  35 failed (35)
```

**claimApprovalTargets budget-exceeded の非空虚性**: `totalTokens >= budget` の条件を
`totalTokens > budget` に書き換えると、「budget-exceeded when totalTokens >= budget」テストが
`expected 'claimed' to be 'budget-exceeded'` で FAIL することを確認。

**recordApprovalDecisions fail-soft の非空虚性**: `try/catch` を削除すると
「does NOT throw and returns successfully when audit sink fails」テストが
`Error: DB is down` で FAIL することを確認。

**maskedArgKeys 値漏洩防止の非空虚性**: `Object.keys()` の代わりに `Object.values()` を返すよう
変更すると、「never contains the VALUE of any key」テストが `'do-not-log-this' to not be "do-not-log-this"` で FAIL することを確認。

### Verification Gate

```
mise run check
  lint: Checked 167 files in 81ms. No fixes applied.
  audit: No known vulnerabilities found.
  typecheck: apps/worker ✓ | apps/web ✓ | packages/* ✓
  test:run: 68 test files passed / Tests 766 passed | 1 skipped
```

Test count delta: 729（Task 8 gate） → 766（Task 9 gate）= **+37 新規テスト**
（35 x `approvals.spec.ts` + 2 x `stores-job-step.spec.ts` 追加ケース）

---

## Task 10: 承認ルートを「検証してから送る」へ転換する（C-12）（2026-09-23）

### 実施内容

**10.1 — `apps/web/tests/jobs-approve-route.spec.ts` テスト追加（TDD先行）**

既存 10 テストを Section A として保存したまま、Section B として 20 テストを追加（計 30 テスト）。
追加ケース:
- D1: `history` / `model` / `usage` を含む余剰フィールド → 400 かつ `claimApprovalTargets` 未呼び出し（R5.2/5.3/5.5）
- セット形受理: 2 決定 → `submitApproval` が 2 回呼ばれる（R9.1）
- 重複 `toolCallId` → 409 かつ DB 未アクセス（R9.3/9.6）; 409 ボディに toolCallId を含まない（R9.5）
- not-claimable 単一形 → 404（R6.2/6.3）; セット形 → 409（R9.2）; ボディが同一（R6.4）
- budget-exceeded → 429; `submitApproval` 未呼び出しだが `claimApprovalTargets` 呼び出し済み（R7.2/7.3）
- 監査成功後に記録呼び出し（D4/R8.1）; 監査失敗でも 202 が返る（R8.3）

モックは `vi.mock(import(...), async (importOriginal))` の部分モック方式: `normalizeApprovalRequest` / `findDuplicateTarget` / `resolveJobTokenBudget` は実装を使い（純関数のためネットワーク不要）、`claimApprovalTargets` と `recordApprovalDecisions` のみ差し替えた。

**10.2 — `apps/web/src/app/api/jobs/[id]/approve/route.ts` 全面書き替え**

旧「fire-and-forget」実装（独自 `z.object` → `submitApproval` 即呼び出し）を廃止し、
`lib/approvals.ts` のオーケストレーション経由に転換:

1. `authorizeJobAccess` → 400/401/404/403（不変）
2. JSON parse → 400 on fail
3. `approvalRequestSchema.safeParse` → 400（`z.strictObject` で余剰フィールド拒否 D1）
4. `normalizeApprovalRequest` → `{ decisions, submittedAs }`
5. `findDuplicateTarget` → 409（DB 接触前）
6. `getWebDb` + `createJobStepStore` + `createAuditSink`（失敗時は 500; fail-closed 設計）
7. `claimApprovalTargets` → not-claimable → 404/409; budget-exceeded → 429; claimed → continue
8. `recordApprovalDecisions`（fail-soft, try/catch でバックアップ）
9. `submitApproval` × N（claimed.decisions ループ）
10. 202 `{ ok: true }`

**10.3 — doccomment 書き替えとペリフェリー確認**

- route.ts のドックコメントを「D1〜D5 の各防御・ADR-1 方針転換記録」として全面改訂
- `ApprovalPanel.spec.tsx`（10 テスト）、`jobs.spec.ts`（10 テスト）が無改変で GREEN ✓

### PROVE 証拠（非空虚性）

**実装前 RED 確認**（route.ts 書き替え前、テスト追加直後）:

```
FAIL  web  tests/jobs-approve-route.spec.ts
  Error: [vitest] No "normalizeApprovalRequest" export is defined on the "@/lib/approvals" mock
  Tests  18 failed | 12 passed (30)
```

※ 部分モック方式に切り替えた後、route.ts の `if (process.env.DATABASE_URL?.trim())` ガードが
原因でさらに 12 失敗（store = undefined → 500）。ガードを削除して `try/catch` に変更後に全 30 GREEN。

**D1 strictObject 実証**: `approvalRequestSchema` の `z.strictObject` を `z.object` に変えると
`"returns 400 when single form carries an extra field"` が `expected 400 to be 202` で FAIL。

**not-claimable 404 実証**: `case "not-claimable"` を削除すると
`"single-form not-claimable → 404"` が `expected 404 to be 202` で FAIL。

### Verification Gate

```
mise run check
  lint: 167 files, No fixes applied.
  audit: No known vulnerabilities
  typecheck: apps/worker ✓ | apps/web ✓ | packages/* ✓
  test:run: 68 test files passed | 786 passed / 1 skipped
```

Test count delta: 766（Task 9 gate） → 786（Task 10 gate）= **+20 新規テスト**
（20 x `jobs-approve-route.spec.ts` Section B）

---

## Task 11: egress ポリシー迂回の回帰スキャン（C-6）（2026-09-23）

### 実施内容

**11.1〜11.3 — `tests/repo/egress-policy-bypass.spec.ts` 新規作成**

7 テストを 4 グループに作成:

- **Pre-flight**: `ALLOWED_EXCEPTION_PATHS` が非空かつ全パスが実在すること（除外リスト枯れを塞ぐ）
- **11.1 email リテラル scan**: `collectAppPackageSrcFiles`（`apps/[pkg]/src/` + `packages/[pkg]/src/`）を走査。コメント行をスキップし、`EMAIL_LITERAL_RE` にヒットする行を違反として収集。非空虚性（>0 ファイルを走査）を先に assert。
- **11.1 allowlist 迂回 scan**: `ALLOWLIST_OVERRIDE_RE`（`RECIPIENT_ALLOWLIST` への非空配列代入、または `allowlist` パラメータへの @ アドレス含む配列上書き）を同じファイル集合でスキャン。
- **11.2 監査発火点唯一性**: `collectAuditScanFiles`（`apps/web/src/app/api/jobs/` + `apps/web/src/lib/`）を走査し `audit.record(` パターンを検索。`apps/web/src/lib/approvals.ts` 以外で発見されれば FAIL。加えて、authorised firing point が実際に `audit.record(` を含むことを逆向きにもアサート。
- **11.3 出所記載**: ファイル冒頭の行コメントに `pydantic-ai-sandbox/patterns/hitl/tests/test_egress_policy.py` (code span) と `CVE-2026-46678` を明記。`doc-links.spec.ts` は外部リンクでないコードスパンを解析しないため GREEN を維持。

**実装上の罠（tasks.md / Implementation Notes に記録済み）**:

- `/** */` ブロックコメント内のパスパターン（`apps/*/src/**`）は `*/` がコメント終端と誤認される（oxc Transform エラー）。ファイル全体を `//` 行コメントに統一した。
- スキャン対象シグネチャは `deps.audit` ではなく `audit.record(`（`approvals.ts` の実際の呼び出しシグネチャ）。

### PROVE 証拠（非空虚性）

**email リテラル scan の実証**: `packages/tools/src/email.ts` を `ALLOWED_EXCEPTION_PATHS` から除外した状態でテストを走らせると `email.ts` に存在するリテラル類で FAIL することを確認。

**監査発火点の逆アサート**: `apps/web/src/lib/approvals.ts` の `audit.record(` 呼び出しを `// audit.record(` にコメントアウトすると「authorised audit firing point actually contains audit.record()」が FAIL することを確認。

### Verification Gate

```
pnpm exec vitest run --project repo tests/repo/egress-policy-bypass.spec.ts
  Test Files  1 passed (1)
  Tests       7 passed (7)

mise run check
  lint: Checked 168 files, No fixes applied.
  audit: No known vulnerabilities
  typecheck: apps/worker ✓ | apps/web ✓ | packages/* ✓
  test:run: 69 test files passed | 793 passed / 1 skipped
```

Test count delta: 786（Task 10 gate） → 793（Task 11 gate）= **+7 新規テスト**
（7 x `tests/repo/egress-policy-bypass.spec.ts`）

## Task 12: 正本レビューへの §8 追記とバックログの解決（C-13）（2026-09-23）

### 実施内容

**12.1 — `docs/cross-repo-adoption-review.md` §8 addendum 追記**

- Table of Contents に §6〜§8 の 3 エントリを追加（§6 / §7 は既存だったが ToC 未掲載だった）。
- 末尾に `## §8 追記（2026-09-23）— spec 007-cross-repo-adoption-closeout による着地` を追記。
- §8.1: X-17〜X-20 の着地表（全 4 件 ✅）
- §8.1 内の手続き記録: X-19 リネームによる §7.6 / `specs/review/` のリンク是正を「本文改変ではなくリンク先の是正」として明記（追記のみ規約の例外記録）
- §8.2: D1〜D6 の着地表（全 6 件 ✅）、適用面の限定（`apps/web` job/approval のみ）
- §8.3: 検証ゲート状態の記録

**12.2 — §1〜§7 無改変の確認**

`git diff docs/cross-repo-adoption-review.md` を確認: 差分は ToC 3 行追加と §8 のみ。
§1〜§7 本文には本セッションでの変更はゼロ（§7.6 のリンク是正は Task 3.1 の prior commit 分であり、§8 addendum にその旨を記録済み）。

**12.3 — `docs/cross-repo-adoption-backlog.md`, `AGENTS.md`, `CLAUDE.md` 更新**

- `backlog.md` §5: 「新規に起票すべき項目」見出しを「新規に起票し解決した項目（spec 007、2026-09-23 完了）」に変更。X-17〜X-20 の各項目の末尾を「→ **spec 007 により解決**（…完了文言…）」に更新。
- `AGENTS.md` Repo-governance guards 行: `owasp-mapping-citations.spec.ts`（X-20）と `egress-policy-bypass.spec.ts`（D6）の 2 本を末尾に追加。
- `AGENTS.md` HITL approval 節: `job_step` テーブルの不変条件と `POST /api/jobs/:id/approve` が fire-and-forget でなくなった点（400/404/409/429）を追加。
- `CLAUDE.md` durable job flow 行: 承認 API の変更（strict-schema → consume-once → budget check → audit → resume）を付記。
- `CLAUDE.md` Tool-execution audit 行: 承認決定の単一 fail-soft 発火点（`approvals.ts`）を付記。

### Verification Gate

```
pnpm exec vitest run --project repo
  Test Files  8 passed (8)
  Tests       52 passed (52)

doc-links.spec.ts:   3 passed ✓
cross-repo-reference-resolution.spec.ts:   7 passed ✓
```

## Task 13: 検証ゲートと非空虚性・トレーサビリティ（2026-09-23）

### 実施内容

**13.1 — 非空虚性確認（タスク 2 / 5 / 6 / 7 / 8 / 9 / 10 / 11 の各検査）**

各ガード・テストについて「実装または文書を一時的に壊すと落ちること」を確認した。
詳細な PROVE 証拠は各タスクの PDCA do.md 節に既に記録済み。本節では
**タスク 13.1 で新規に実施した追加確認** を記録する:

1. **REQ-005 (5.1) — `approvalDecisionSchema` strict-object の非空虚性確認（本タスク実施）**
   - 操作: `packages/schemas/src/workflows.ts` の `approvalDecisionSchema` を
     `z.strictObject` → `z.object` に変更して `pnpm exec vitest run --project packages packages/schemas/tests/workflows.spec.ts` を実行
   - 観測された失敗:
     ```
     × rejects excess / forbidden fields in single decision (strictObject, D1 proof)
     AssertionError: expected true to be false // Object.is equality
     × approvalRequestSchema rejects payloads with forbidden fields or empty sets
     AssertionError: expected true to be false // Object.is equality
     Tests  2 failed | 44 passed (46)
     ```
   - 復元完了 ✓

2. **REQ-007 (7.2) — budget-exceeded `>=` 境界の非空虚性確認（本タスク実施）**
   - 操作: `apps/web/src/lib/approvals.ts` の `if (totalTokens >= budget)` を
     `if (totalTokens > budget)` に変更して `pnpm exec vitest run --project web apps/web/tests/approvals.spec.ts` を実行
   - 観測された失敗:
     ```
     × returns budget-exceeded when totalTokens >= budget (rows are consumed)
     AssertionError: expected 'claimed' to be 'budget-exceeded' // Object.is equality
     ```
   - 復元完了 ✓

3. **REQ-009 (9.3) — `approvalDecisionSetSchema` strict-object の非空虚性確認（本タスク実施）**
   - 上記 REQ-005 (5.1) と同一のコード変更で確認済み（同一ファイル・同一 `z.strictObject` 呼び出し）

タスク 2 / 6 / 7 / 8 / 9 / 10 / 11 の PROVE 証拠は各タスクの PDCA 節に記録済み。
すべての非空虚性証拠を `traceability.md` の Non-vacuity 列に集約した。

**13.2 — `mise run check` 検証ゲート**

実行コマンド: `mise run check`

結果:
```
lint:       Checked 168 files in 78ms. No fixes applied. ✓
audit:      No known vulnerabilities found. ✓
typecheck:  apps/web ✓ | apps/worker ✓ | packages/* ✓
test:run:   69 test files passed | Tests 793 passed | 1 skipped ✓
lint:model-ids: No hardcoded model IDs found. ✓
```

追加確認項目:
- カバレッジ: lines 90.96% / functions 82.19% / branches 92.08% / statements 91.03%（≥ 80% ✓）
- `.github/workflows/` ファイル数: **7 本**（api.yml / eval-nightly.yml / eval-pr.yml / lint.yml / python.yml / security-daily.yml / tests.yml）。新規追加なし ✓
- `GET /api/jobs/:id/stream` route: 本 spec での変更なし（last commit は先行作業分）✓
- `jobEventTypeEnum` 定義: `packages/db/src/schema.ts:139` で無改変 ✓
- `packages/agents/tests/audit-hook.spec.ts`（既存ツール実行監査テスト 4 件）: 793 passed の内数として GREEN ✓

**13.3 — `traceability.md` 完成**

- Non-vacuity 列（6 列目）を追加し、73 全受け入れ基準について証拠を記入
- REQ-011 (11.1〜11.7) の Test + Non-vacuity + Commit 列を埋めた（commit: `b894e19`）
- REQ-012 の Test + Non-vacuity + Commit 列を埋めた（commit: T-13）
- REQ-007 (7.6) の Commit を "pending" → `a707139` に更新
- REQ-008 (8.2) / REQ-008 (8.5) / REQ-010 (10.1〜10.5) の Commit を `020941a` に更新
- 「承認経路テストのネットワーク独立性（REQ-012.5）」節を追加
- 「plan による spec の訂正 3 点」が本表下部に記録済みであることを確認

### Verification Gate

```
mise run check
  lint: 168 files, No fixes applied. ✓
  audit: No known vulnerabilities. ✓
  typecheck: apps/web ✓ | apps/worker ✓ | packages/* ✓
  test:run: 69 test files, 793 passed / 1 skipped ✓
  lint:model-ids: No hardcoded model IDs found. ✓
```

カバレッジ: 90.96% lines / 82.19% functions — 閾値 80% 超過 ✓

---
