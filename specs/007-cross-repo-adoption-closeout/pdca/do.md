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
