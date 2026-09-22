# 007-cross-repo-adoption-closeout — Discovery & Research Log

`/sdd-plan` 中に作成。調査日 2026-09-22。実測で確定した事実・決定・リスクを記録する。
散文は日本語、識別子・型・パス・コードは英語。

> `.sdd/steering/` は**存在しない**。プロジェクトメモリの代替として `CLAUDE.md` /
> [`AGENTS.md`](../../AGENTS.md) / [`specs/memory/constitution.md`](../memory/constitution.md)
> を steering 相当として読んだ（`gap-analysis.md` と同じ扱い）。

## Discovery type

**Extension (light)** — 既存の 2 文書・既存の `tests/repo/` ガード群・既存の
job/approval 経路を拡張する。新規サブシステム・新規外部依存はない
（新規テーブル 1 枚と migration 1 枚は既存 `packages/db` の作法内）。
`~/.claude/sdd/rules/plan-discovery-light.md` の 5 手順を実施した。

## Investigations

### I-1 拡張面の特定（承認経路）

- **Question**: D1〜D6 を載せる面はどこまでか。誰が pending set の真実を持つか。
- **Findings**: 承認 API は `POST /api/jobs/:id/approve` の 1 ファイル 82 行で、
  `authorizeJobAccess` → `approvalRequestSchema.safeParse` → `submitApproval(engine, signal)` →
  **無条件 202** の fire-and-forget。suspend の実体は Inngest `step.waitForEvent`
  （`toApprovalGate`）の中だけにあり、それを問い合わせる API は engine 固有のため
  ADR-2（Inngest import は `apps/worker/src/inngest.ts` のみ）により web からは触れない。
  → **pending set を Postgres にミラーしない限り R6.2 / R7.2 / R9.2 は原理的に作れない**。
- **Evidence**: `apps/web/src/app/api/jobs/[id]/approve/route.ts:39-68`（202 即返し）/
  `apps/worker/src/main.ts:245-253`（`createDurableStepRunner.run` が `approvalGate` を await）/
  `apps/worker/src/main.ts:538`（`submitApproval` は `engine.send` に `id` を渡していない）/
  `AGENTS.md` の "only file that imports the Inngest SDK"。

### I-2 Inngest 関数本体の再実行と冪等性

- **Question**: pending set の書き込みを worker に置くとき、再開のたびに consume 済みが
  pending へ戻らないか。
- **Findings**: `runJob` は Inngest のリトライ／resume ごとに**関数本体全体が再実行される**。
  既存の `jobStore.insert` はそのために `onConflictDoNothing({ target: job.id })` を使う。
  同じ理由で pending 登録も `onConflictDoNothing` でなければならない
  （`DO NOTHING` なら既存行の `consumed` を上書きしない）。
  また `approvalGate` は意図的に `engineStep.run` で包まれていない
  （二重 memoize とネスト step を避けるため）ので、ここへ書き込みを足すときも step を作らない。
- **Evidence**: `apps/worker/src/main.ts:431-437`（冪等 insert の理由コメント）/
  `apps/worker/src/stores.ts:119-127` / `apps/worker/src/main.ts:209-231`
  （`engineStep.run` で包まない長い理由書き）。

### I-3 usage を積算する単一点と二重計上の罠

- **Question**: suspend/resume を跨ぐ累積 usage をどこで観測するか。
- **Findings**: usage は `supervisor.ts` の**終端でのみ**集計され（`metrics` を組み立てる
  ループ）、承認時点では web から読めない。`publish`（emit）は `step.run` の**外**で呼ばれる
  ため、Inngest 再実行時に `completion` イベントが**再発火する**。したがって
  「カウンタを increment する」設計は再実行で二重計上する。**(jobId, stepId) をキーに
  絶対値を書く**形（upsert）だけが replay-safe。
  `rag-research` はモデルを呼ばないため `usage` を持たず、実質 `document-generation` のみが
  予算を消費する（R7.6 のクレームは `Partial · accepted` になる）。
- **Evidence**: `packages/agents/src/supervisor.ts:520-546` / 同 `publish` は
  `emit?.(event)` の薄いラッパ（`supervisor.ts:409-411`）/
  `apps/worker/src/main.ts:352`（`instrumentEmit` の span Map はプロセス内）。

### I-4 D1 は「実装ギャップ」ではなく「証明ギャップ」

- **Question**: 履歴・usage・model の注入は今どこまで閉じているか。
- **Findings**: `approvalRequestSchema` は `{ toolCallId, decision, args? }` のみで
  履歴/usage/model フィールドを**持たない**（5.1 充足）。`args` 内に潜らせた偽造キーも
  `mergeApprovedArgs` の `specialistInputSchema.parse` が strip する。resume 後のメッセージ列は
  `event.data.plan` を再 parse したサーバ側状態のみで、doc-gen specialist は `system` ＋ `prompt`
  だけを渡し `messages` を渡さない（保持する会話が構造的に存在しない）。
  **残るギャップは実質 `z.object` → `z.strictObject` の 1 行**（Zod v4 の `z.object` は
  未知キーを黙って strip する = reject しない）とテストである。
  ただし `data-processing.input: z.unknown()` は任意 JSON を通す通し穴として残る。
- **Evidence**: `apps/web/src/app/api/jobs/[id]/approve/route.ts:33-37` /
  `packages/agents/src/supervisor.ts:414-426`（`mergeApprovedArgs`、`kind` を task 側に固定）/
  同 `:342-349`（doc-gen は `system` ＋ `prompt` のみ）/ `apps/worker/src/main.ts:335`
  （`supervisorPlanSchema.parse` で再検証）/ `packages/schemas/src/workflows.ts:66`。

### I-5 対応表 2 文書の実測構造

- **Question**: 引用の書式はガードでパースできるか。リネームで何が壊れるか。
- **Findings**:
  - Agentic 側は 134 行・`## ` 見出し **10 個**（T1〜T10 相当）。T11〜T15 の語は 1 度も出ない。
  - **本文は既に ASI を名乗っていない**（`grep "ASI"` はヒット 0、H1 も
    「脅威分類 対応表(レイヤ別)」）。**不一致はファイル名のみ**で、R3 の実作業は
    リネームと参照更新に限られる。
  - 引用は `- 実装:` / `- テスト:` の行頭キーで**既にほぼ構造化されている**が、
    シンボルは散文中に 3 形（`の isExternallyDrivenTurn` / 括弧付き / em dash 付き）で混在し、
    `- 未対応:` という第 4 のキーもある。CI 引用は
    「ステップ名」と「シェルコマンド」（`` `pnpm audit --audit-level=moderate` ``）が同一キーに同居する。
  - **副産物の実測**: `docs/owasp-llm-top10-mapping.md:56` は「全 6 ワークフロー」と書くが
    実測 **7 本**（`api.yml` 追加後）。R2 で全節に手を入れる際に是正する。
- **Evidence**: `wc -l` / `grep -n '^## '` / `sed -n` による直接確認（上記各行）。

### I-6 リネームで壊れる参照の全数（実測）

`grep -rn "owasp-agentic-ai-top10-mapping"`（`node_modules` / `.git` / `services/api` 除外）
の結果は **7 箇所 / 6 ファイル**。`AGENTS.md` には参照が**無い**（spec 3.4 の列挙は 1 件過大）。

| # | 箇所 | 形式 | `doc-links` が落とすか | 扱い |
|---|---|---|---|---|
| 1 | `CLAUDE.md:7` | リンク | 落ちる | 通常更新 |
| 2 | `docs/owasp-llm-top10-mapping.md:12` | リンク | 落ちる | 通常更新（R3.5 相互参照） |
| 3 | `docs/cross-repo-adoption-backlog.md:139` | リンク | 落ちる | 通常更新（R11.5 と同時） |
| 4 | `docs/cross-repo-adoption-backlog.md:152` | コードスパン | 落ちない | 内容整合のため更新 |
| 5 | `docs/cross-repo-adoption-review.md:727` | リンク | 落ちる | **R11.4** リンク先のみ是正 |
| 6 | `specs/review/2026-09-22-cross-repo-verification.md:94` | リンク | 落ちる | **R11.4 に準ずる**（ADR-4） |
| 7 | `specs/review/…:317` / `gap-analysis.md:139` | コードスパン | 落ちない | 時点の記録・grep 引用として不変更 |

加えて `specs/007-cross-repo-adoption-closeout/gap-analysis.md:51` が旧名への**リンク**を持つ
（本 spec 自身の文書。同時に更新する）。

### I-7 出所タクソノミの版（外部一次情報、実測）

| タクソノミ | 版 | 公開日（ISO-8601） | 取得元 |
|---|---|---|---|
| OWASP Top 10 for LLM Applications 2025 | 2025 版 | `2024-11-17` | `genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/`（WebFetch） |
| Agentic AI – Threats and Mitigations | v1.0 | `2025-02-17` | `genai.owasp.org/resource/agentic-ai-threats-and-mitigations/`（WebFetch） |

**T1〜T15 の番号割り当ては一次情報から確定できなかった**（ランディングページは脅威 ID を
列挙せず、列挙は PDF 本体のみ）。憲章 principle 8（実測主義／記憶を根拠にしない）により、
plan は**脅威名を機械検査の主キーにし、`T<n>` 番号に依存しないガード設計**を採る（ADR-2）。

**追加観測（再評価トリガの材料）**: OWASP は後続として `OWASP Top 10 for Agentic
Applications for 2026` を公開している。本 spec は Threats and Mitigations（15 脅威）を
正として選ぶため（R3.1）、これは「将来この対応表を別タクソノミへ再ベースラインする」
具体的な再評価トリガになる。

### I-8 `cross-repo-reference-resolution.spec.ts` は着手前から赤（実測）

- `pnpm exec vitest run --project repo` → **1 failed / 17 passed**。
- 失敗メッセージ: `specs/007-cross-repo-adoption-closeout/spec.md` が `cross-repo-adoption-review.md`
  への 2 階層上相対リンク（`../../docs/` 経由）を持つことによる stale 判定。
- 原因: `QUALIFIED_FORM` の文字クラスが `.` を含むため、`..` セグメントを
  **リポジトリ名として捕捉**する。`..` ≠ `vaz-agentic-ai-next` なので stale 判定になる。
- 同ガードは `doc-links.spec.ts` と違い `stripCode` を持たず生テキストを走査するため、
  コードスパン／fenced block 内で**パスを話題にしただけ**でも将来同じ偽陽性を起こす。
- **R11.6（両ガードが緑）の先行ブロッカー**であり、本 spec の最初のタスクになる（ADR-3）。

## Existing patterns to reuse

| Pattern | Location | Why reuse |
|---------|----------|-----------|
| repo ガードの骨格（ツリー走査 → 非空アサート → 例外リストの実在検査） | [`tests/repo/doc-links.spec.ts`](../../tests/repo/doc-links.spec.ts)（`stripCode` / `VENDORED_ROOTS` / `checkedLinks > 0`） | R4.6 / R10.2 / R10.3 / R4.7 がそのまま写像できる |
| YAML ワークフローのパース（`yaml` の `parse`） | [`tests/repo/ci-workflows.spec.ts`](../../tests/repo/ci-workflows.spec.ts) | R4.3 の CI ステップ名検査で `name:` を構造的に読む |
| ガード精度の後追い修正という先例 | [`tests/repo/model-id-gate-precision.spec.ts`](../../tests/repo/model-id-gate-precision.spec.ts)（spec `006` が `forbid-model-ids.sh` を assignment-form-only に絞った） | ADR-3 のガード修正が「新方針」ではなく既存の判断パターンであることの根拠 |
| ネットワーク非依存の承認ルートテスト（engine / `submitApproval` / `authorizeJobAccess` を `vi.hoisted` で全モック） | [`apps/web/tests/jobs-approve-route.spec.ts`](../../apps/web/tests/jobs-approve-route.spec.ts)（既存 11 テスト） | R12.5 を満たし、R9.4 の後方互換の回帰ガードとして既に機能する |
| 監査の fail-soft ＋ R4.7 安全ログ（try/catch → `logger.error` に相関フィールドのみ） | [`packages/agents/src/audit-hook.ts`](../../packages/agents/src/audit-hook.ts) | R8.3 / R8.4 の実装形そのまま |
| 予算 env（`z.coerce.number().int().positive().default(...)`） | [`packages/schemas/src/env.ts`](../../packages/schemas/src/env.ts)（`CHAT_TOKEN_BUDGET`） | R7.4 を同型の 1 行で満たす |
| 冪等な DB 書き込み（`onConflictDoNothing`） | [`apps/worker/src/stores.ts`](../../apps/worker/src/stores.ts)（`createJobStore.insert`） | I-2 の replay 罠を構造的に塞ぐ |
| 手書き SQL migration ＋ DDL ドリフトテスト | [`packages/db/drizzle/`](../../packages/db/drizzle/0001_add_locator.sql) ＋ [`packages/db/tests/schema-ddl.spec.ts`](../../packages/db/tests/schema-ddl.spec.ts) | 新規テーブルが自動的にドリフト検査の対象になる |
| web が `@vaz/worker` の port を再利用する作法（共有 pool / 遅延構築） | [`apps/web/src/lib/jobs.ts`](../../apps/web/src/lib/jobs.ts) / [`apps/web/src/lib/db.ts`](../../apps/web/src/lib/db.ts) | 新しい読み書きを第 2 の pool を開かずに追加できる |
| 「本 repo はリンク・兄弟 repo はコードスパン」規約 | [`docs/cross-repo-adoption-backlog.md`](../../docs/cross-repo-adoption-backlog.md) §規約 | R10.4 / R11.6 |

## External dependencies

**新規の npm / PyPI 依存は無い。**

| Dependency | Version | Purpose | Verified |
|------------|---------|---------|----------|
| `yaml` | 既存（`ci-workflows.spec.ts` が使用） | R4.3 の CI ステップ名パース | ✅ 既存 import で実績あり |
| `zod` | v4（既存） | `z.strictObject` / `z.union` による D1・D5 の入口契約 | ✅ v4 は `z.strictObject` を持つ |
| `drizzle-orm` / `drizzle-zod` | 既存 | 新規テーブル定義と insert/select 契約 | ✅ 既存 6 テーブルと同型 |
| OWASP Top 10 for LLM Applications 2025 | 2025 版 / `2024-11-17` | R3.3 の版日付 | ✅ WebFetch（I-7） |
| OWASP Agentic AI – Threats and Mitigations | v1.0 / `2025-02-17` | R3.1 / R3.3 | ✅ WebFetch（I-7）。ただし T 番号は未確定（I-7） |

## Architecture decisions

### ADR-1: 承認 API を fire-and-forget から「検証してから送る」へ転換し、pending set を Postgres にミラーする

- **Context**: R6.2（3 ケースを単一 404）・R7.2（429）・R9.2（決定セットの原子的拒否）は
  いずれも「`engine.send` の**前に**その承認対象が決定を受け付けられるかを判定する」ことを
  要求する。ところが真実は Inngest の中にしかなく、ADR-2 により web から読めない（I-1）。
  現行 `route.ts` のドックコメントは fire-and-forget を明示的な設計方針として宣言している。
- **Decision**: 承認 API を **DB を single source of truth とする「検証＋消費 → 送信」** へ
  転換する。pending set は **worker が suspend する瞬間に Postgres へ冪等に書く**
  （`onConflictDoNothing`、I-2）。web は 1 トランザクションで「累積 usage の読み出し ＋
  対象の消費」を行い、成功したときだけ `engine.send` する。
  `POST /api/jobs` 側は 202 fire-and-forget のまま残す（非対称は意図）。
- **Alternatives**:
  - *engine へ無条件に送り、consume-once は worker 側 gate で判定*: R6.2 が **API の応答として
    404** を要求するので両立しない。
  - *engine 側 idempotency key のみ*（`submitApproval` に `id` を渡す）: 多重送信を畳むだけで、
    404 / 409 / 429 の応答は作れない。**ただし併用する**（送信の冪等化として有効・低コスト）。
- **Consequences**: 承認 API に DB 依存が入る（`apps/web/src/lib/db.ts` の共有 pool を再利用）。
  `route.ts` のドックコメントの方針転換を明記する必要がある。残余リスクは ADR-6。

### ADR-2: 15 脅威の機械検査は「脅威名」を主キーにし、`T<n>` 番号に依存しない

- **Context**: 一次情報（OWASP ランディングページ）は T1〜T15 の番号割り当てを列挙せず、
  PDF 本体のみが持つ（I-7）。憲章 principle 8 は記憶を根拠にした記述を禁じ、
  「誤りが判明した記述は訂正ではなく削除し、実測結果で置き換える」と定める。
- **Decision**: R1.6 の索引表は**脅威名（出所 verbatim）→ 自文書の節見出し**の対応を主キーにし、
  ガードは (a) 索引の行数が 15、(b) 各行が同一文書内に実在する `## ` 見出しを指す、
  (c) 各 `## ` 脅威節が索引に 1 度だけ現れる（全単射）を検査する。
  `T<n>` 列は**一次 PDF から実測して埋める補助列**とし、ガードの判定には使わない。
- **Alternatives**: *T 番号を記憶から書く* → principle 8 違反。
  *T 番号列を設けない* → spec 本文（「T11〜T15」）との読み合わせが難しくなる。
- **Consequences**: 番号が一次情報から取れない場合でも「15 脅威全件を収録」は機械的に
  保証される。番号確定は独立したタスクになり、失敗しても R1 / R4 は着地できる。

### ADR-3: `cross-repo-reference-resolution.spec.ts` の偽陽性はガード側を精密化して閉じる

- **Context**: 同ガードは着手前から赤で、原因は正規表現が相対パスの `..` を
  リポジトリ名として捕捉することにある（I-8）。R11.6 は「両ガードが緑」を完了条件にする。
- **Decision**: **ガードを精密化する**——`QUALIFIED_FORM` が捕捉した名前が `.` / `..` 等の
  相対パス断片である場合を stale 判定から除外する。`specs/<feature>/` からの
  正本レビューへのリンクは規約どおり**リンクのまま維持**する。
- **Alternatives**:
  - *`spec.md:5` をコードスパンへ直す*: 緑にはなるが、「本 repo 内の文書はリンク」という
    規約に未文書化の例外（2 階層下は不可）を作る。規約の正本を曲げる側の変更。
  - *`stripCode` も同時に導入*: 第 2 の偽陽性クラス（コードスパン内の言及）も塞げるが、
    本 spec の AC が要求していない振る舞い変更。**採らない**——既知の限界としてリスクに残す。
- **Consequences**: spec `006` が `forbid-model-ids.sh` を assignment-form-only へ絞った
  先例（`model-id-gate-precision.spec.ts`）と同種のガード精度修正であり、新方針ではない。
  最初のタスクとして単独で着地させる（他のすべての文書作業がこのガードの下で走る）。

### ADR-4: `specs/review/2026-09-22-cross-repo-verification.md` もリンク先のみ是正する

- **Context**: R11.4 は「追記のみ規約の文書内」と限定するが、同ファイルも時点の記録であり、
  リネームでリンクが解決しなくなる（I-6 #6）。是正しないと `doc-links.spec.ts` が落ちる。
- **Decision**: **リンク先のみを是正し、主張・測定値・判定は一切変えない**。是正した事実を
  §8 addendum に「本文の改変ではなくリンク先の是正」として、正本 §7.6 の分と併記して記録する。
- **Alternatives**: *不変更* → `doc-links.spec.ts` が赤（R11.6 不成立）。
  *旧名のファイルをスタブとして残す* → 収録が 2 か所に分裂し R1.6 の全単射が壊れる。
- **Consequences**: 「追記のみ」の運用は「主張は不変更／リンク先は保守対象」として
  1 段精密化される。この解釈自体を addendum に書き残す。

### ADR-5: 新しい永続状態は `job_step` 1 枚に集約する（承認状態 ＋ 観測 usage）

- **Context**: R6.6（再起動を跨ぐ consume-once）と R7.1（境界を跨ぐ累積 usage）が
  新しい永続状態を要求する。`job` 表は `{ id, userId, status, workflow, createdAt }` のみ。
  NFR は「追加 DB ラウンドトリップ 2 回以内」を課す。
- **Decision**: **`job_step` テーブル 1 枚**（PK `(job_id, step_id)`）に
  承認状態（`approval_state`: `pending` / `consumed`、承認対象でない step は NULL）と
  **その step で観測した総トークン数の絶対値**（`total_tokens`）を置く。
  web は 1 トランザクションで `sum(total_tokens)` の読み出しと消費 UPDATE を行う
  （**追加ラウンドトリップ 1 回**）。migration は `packages/db/drizzle/0002_add_job_step.sql`。
- **Alternatives**:
  - *`job_event` へ相乗り*: `jobEventTypeEnum` は `jobEventTypeSchema` とロックステップの
    pg enum で、値追加は SSE 公開契約の変更になる（R7.5 の後方互換方針に逆行）。✗
  - *`job` へ列追加のみ*: consume-once は承認対象ごとなので `job` 単位に収まらない。✗
  - *usage を別テーブルに分離*: 2 枚になり、予算読み出しと消費が 2 ラウンドトリップに増える。✗
  - *Redis*: 本 repo では Redis はイベント fan-out 専用。永続保証を負わせるのは新方針。✗
- **Consequences**: `packages/db` は schema-only のまま（pool は composition root）で
  依存方向は不変。`schema-ddl.spec.ts` のドリフトテストが自動で新テーブルを守る。
  **usage は increment ではなく (jobId, stepId) 単位の絶対値 upsert** なので Inngest の
  関数本体再実行で二重計上しない（I-3）。

### ADR-6: 「消費した後・送信前」のクラッシュは残余リスクとして受容する

- **Context**: R9.2 の真の原子性は engine 越えでは達成できない。DB を single source of
  truth にし `engine.send` を `id: "<jobId>:<stepId>"` で冪等化しても、
  「消費コミット後・送信前」にプロセスが落ちると再開されないまま消費済みになる。
- **Decision**: **受容する**。DB 側の原子性（R9.2 / R9.6「いずれも消費しない」）は満たされ、
  未送信は Inngest 側の approval timeout（`DEFAULT_APPROVAL_TIMEOUT`）が
  `ApprovalDeniedError("expired")` として終端させる——ジョブが無言で吊り下がる経路は無い。
  この受容と再評価トリガを対応表（Overwhelming HITL / Repudiation 節）に書く。
- **Alternatives**: *outbox パターン*（送信待ちを DB に持ち worker が掃く）→ 本 spec の
  AC が要求しておらず、engine の責務と重複する新サブシステムになる。✗
- **Consequences**: `docs/owasp-*` の該当クレームは `Partial · accepted` になる。
  再評価トリガ: 「承認 timeout を無効化するか、承認対象あたりの再送 UI を導入したとき」。

### ADR-7: 承認決定の監査は `audit_log` を再利用し、承認経路の**第 2 の単一発火点**として宣言する

- **Context**: 憲章 principle 5 は「監査ログの発火点は 1 か所」と定める。既存の単一発火点は
  `packages/agents/src/audit-hook.ts`（**ツール実行**）。承認決定はツール実行ではない別事象で、
  発生場所も `apps/web` のルートであり literal な合流は不可能。
- **Decision**: `audit_log` テーブルを再利用し（新テーブルを作らない）、
  `tool: "approval:decision"`、`args: { stepId, decision, editedArgKeys }`（**キー名のみ**、
  値は載せない）、`userId: callerId`、`jobId` を記録する。発火点は
  `apps/web/src/lib/approvals.ts` の **1 関数のみ**とし、ルートからの呼び出しは 1 箇所に限る。
  先例として `supervisor.ts` の programmatic rag-research 用 2 番目の明示 `record` を引く。
- **Alternatives**: *専用テーブル* → 監査の読み出しが 2 か所に分裂。✗
  *`audit-hook.ts` を拡張* → ツール実行イベントを持たない承認決定を無理に通す。✗
- **Consequences**: `AuditEntry.tool` の意味が「ツール名」から「監査対象の事象名」へ
  広がる。名前空間付き（`approval:`）にして既存のツール名と衝突させない。
  `audit_log` への書き込み経路が 2 つになる点を Constitution Compliance で ⚠️ として申告する。

### ADR-8: 対応表の引用を「構造化引用ブロック」に統一する

- **Context**: R4.1〜4.3 は引用（パス / シンボル / CI ステップ名）の実在を機械検査する。
  現状はシンボルが散文中に 3 形、CI 引用はステップ名とシェルコマンドが同一キーに混在（I-5）。
  散文を正規表現で拾う設計は「書式が増えるたびに静かに見落とす」——非空アサートで塞ぐ
  偽陽性緑の親戚である。
- **Decision**: 各節末を**固定キー行**に統一する。R1 / R2 で**どうせ全節に手が入る**ため
  追加コストは小さい。
  ```
  - 状態: Mitigated | Partial · accepted | Accepted
  - 実装: `path` / `symbol` の列挙（リンク可）
  - テスト: `path` / `symbol` の列挙
  - CI: `.github/workflows/<file>.yml` — `<step name>`（任意、0 回以上）
  - 再評価トリガ: <具体的な将来の変更>（状態が Mitigated 以外なら必須）
  ```
  パス／シンボルの判別は「`/` を含み既知の拡張子で終わるならパス、それ以外はシンボル」。
  シンボルは**直前に挙げたパスのいずれかの中に実在すること**を検査する。
  旧 `- 未対応:` キーは廃止し、`- 状態:` ＋ `- 再評価トリガ:` へ吸収する（R2.2）。
- **Alternatives**: *散文を正規表現で拾う* → 高リスク（上記）。✗
  *引用を YAML 台帳へ外出し* → 二重管理になり文書が正本でなくなる。✗
- **Consequences**: 将来の節追加も同形を強制される。`- CI:` を独立キーにしたことで
  「ステップ名 vs シェルコマンド」の混在が構造的に解消する（コマンドは散文へ移す）。

### ADR-9: 承認の wire 契約は `@vaz/schemas` に置き、単一形とセット形の判別可能 union にする

- **Context**: R9.1（セット受理）と R9.4（既存単一ボディ維持）を同時に満たす必要がある。
  現在スキーマは `route.ts` にインラインで、境界契約が `apps/web` に閉じている。
  憲章 principle 2 は層の越境データを Zod で検証することを MUST とする。
- **Decision**: `packages/schemas/src/workflows.ts` に
  `approvalDecisionSchema`（`z.strictObject({ toolCallId, decision, args? })`）と
  `approvalRequestSchema = z.union([approvalDecisionSchema, z.strictObject({ decisions: [...] })])`
  を置く。ルート入口で単一形を `{ decisions: [body] }` へ**正規化**し、以降のロジックを
  1 経路に保つ（principle 5）。**投稿された形（単一 / セット）は保持**し、
  不正対象時の応答コード選択（単一 → 404、セット → 409）に使う。
- **Alternatives**: *セット形のみへ移行* → R9.4 が明示的に禁止。✗
  *`route.ts` にインラインのまま* → 境界契約が web に閉じ、worker 側テストから参照できない。✗
- **Consequences**: `strictObject` により未定義フィールドが 400 で落ちる（R5.2）。
  `@vaz/schemas` は leaf なので依存方向は不変。既存 11 テストがそのまま回帰ガードになる。

### ADR-10: 新規ロジックは `apps/web/src/lib/approvals.ts` の純関数 ＋ port に置く

- **Context**: カバレッジは `apps/web/src/app/**` を除外し `apps/web/src/lib/**` を対象にする。
  R5〜R9 を `route.ts` に集めると R12.6 は通るが R12.4（非空虚性）が弱くなる。
- **Decision**: 決定セットの検証・正規化・予算判定・マスク済み監査を
  `apps/web/src/lib/approvals.ts` に純関数 ＋ 注入 port（`ApprovalStore`）として置き、
  `route.ts` は HTTP 変換と 1 本のオーケストレーションに留める（既存 `lib/jobs.ts` の作法）。
- **Alternatives**: *`route.ts` 集約* → 非空虚性が弱まる。✗
  *`packages/` に新パッケージ* → 依存グラフに 8 個目が増え principle 5 に逆行。✗
- **Consequences**: `route.ts` の差分が最小になり、既存 11 テストの前提が壊れにくい。

## Risks & open questions

- ⚠️ **Inngest 関数本体の再実行が pending set を汚す**（最大の罠）— 緩和: pending 登録は
  `onConflictDoNothing`、usage は (jobId, stepId) 単位の絶対値 upsert。
  consume 済みを pending へ戻す経路をコードに持たせない（`state` を戻す UPDATE を書かない）。
  この 2 点を明示的なテスト（同一 stepId で登録を 2 回実行 → 消費済みが維持される）で固定する。
- ⚠️ **「消費後・送信前」のクラッシュ** — ADR-6 で受容。approval timeout が終端を保証する。
- ⚠️ **`data-processing.input: z.unknown()` の通し穴** — R5.3 を無条件のクレームとして
  書けない。緩和: 対応表で `Partial · accepted` ＋ 再評価トリガ
  「`data-processing` specialist を実装したとき」。
- ⚠️ **予算が実質 `document-generation` のみを数える** — `rag-research` はモデルを呼ばない。
  緩和: R7 のクレームを `Partial · accepted` とし、再評価トリガ
  「`document-generation` 以外の specialist が直接モデルを呼ぶようになったとき」。
- ⚠️ **`cross-repo-reference-resolution.spec.ts` の第 2 の偽陽性クラス**（`stripCode` 不在）—
  ADR-3 では塞がない。既知の限界として残す。再評価トリガ:
  「コードスパン内の言及で同ガードが再び赤になったとき」。
- ⚠️ **D6 ガードの初日グリーン** — 実測では `apps/*/src` ＋ `packages/*/src` に
  メールアドレス形リテラルは 0 件。ただし doc コメント中の例示（`z.email()` の説明等）が
  将来混入しうる。緩和: 例外リストを設け、その各パスの実在を検査する（R10.3）。
- ⚠️ **`audit_log` への書き込み経路が 2 つになる** — ADR-7 で申告済み。
  緩和: 承認側は `approval:` 名前空間 ＋ 発火点 1 関数に限定し、テストで発火点が 1 つであることを固定する。
- ❓ **T1〜T15 の番号割り当て** — 一次 PDF 未取得（I-7）。ADR-2 によりガードは番号に依存しない。
  解決は `/sdd-impl` の R1 タスク内（一次 PDF を取得して補助列を埋める。取得できない場合は
  補助列を置かず、その事実を文書冒頭に実測として明記する）。
- ❓ **spec 本文の 2 点の不正確さ**（`/sdd-impl` では plan の記述を正とする）—
  (a) R12.2「既存 6 本」は実測 **7 本**（`api.yml`）。要件の意図（新規ワークフローを増やさない）は不変。
  (b) R3.4 の参照列挙にある `AGENTS.md` には参照が**無い**（I-6）。列挙は 1 件過大。
  いずれも plan の「File Structure Plan」と「Requirements Traceability」で訂正済みとして扱う。
