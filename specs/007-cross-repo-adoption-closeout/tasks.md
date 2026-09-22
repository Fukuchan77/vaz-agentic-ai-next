# 007-cross-repo-adoption-closeout — Implementation Tasks

`/sdd-tasks` が生成。[`spec.md`](spec.md) の受け入れ基準と [`plan.md`](plan.md) の
コンポーネント（C-1〜C-14）／File Structure Plan に対応する。散文は日本語、
識別子・型・パス・コードは英語。

規約:

- `- [ ]` 未着手 / `- [x]` 完了 / `- [ ]*` 任意（MVP 後に回せるテスト）。
- `(P)` は並行実行可（依存なし ＋ 境界が交差しない）。
- すべてのタスク（major / sub）が `_Boundary:_` と `_Depends:_` を宣言する。
  `_Boundary:_` は [`plan.md`](plan.md) の File Structure Plan の行のみを対象にできる。
- `_Requirements:_` は数値 ID のみをカンマ区切りで列挙する。
- `_Traces:_` は [`traceability.md`](traceability.md) と `/sdd-impact` が使う安定 ID
  （`REQ-###` = `spec.md` の Requirement 見出し、`DES-#.#` = `plan.md` の設計節。
  対応規則は [`traceability.md`](traceability.md) 冒頭に記載）。

進行順は [`plan.md`](plan.md) の Summary が固定した 4 つの塊に従う:
**塊 0 先行ブロッカー（タスク 1）→ 塊 1 文書 4 項目（タスク 2〜4）→
塊 2 承認経路 6 防御（タスク 5〜11）→ 塊 3 正本への追記と記録（タスク 12〜13）**。
各塊の完了後に新規コンテキストで敵対的レビューを 1 回実施する（憲章 principle 10）。

---

## 1. 先行ブロッカー — 相対パス断片による stale 偽陽性を閉じる

着手前から `repo` プロジェクトが 1 failed（`research.md` I-8）。他のすべての文書作業が
このガードの下で走るため、単独で最初に着地させる（ADR-3）。

_Boundary:_ `tests/repo/cross-repo-reference-resolution.spec.ts`
_Depends:_ none
_Requirements:_ 11.6
_Traces:_ REQ-011, DES-3.5

- [x] 1.1 相対リンク形（2 階層上を指す `../` 付きの正本レビュー参照）を含む入力に対して、
      現行の `QUALIFIED_FORM` が `..` をリポジトリ名として捕捉し stale 判定に落ちることを
      回帰ケースとして先に固定する（実測 I-8 をテストの形にする。この時点で赤）
  _Boundary:_ `tests/repo/cross-repo-reference-resolution.spec.ts`
  _Depends:_ none
  _Requirements:_ 11.6
  _Traces:_ REQ-011, DES-3.5
- [x] 1.2 `QUALIFIED_FORM` が捕捉した候補名のうち相対パス断片（`.` / `..`）を stale 判定の
      対象外にし、既存 4 テストの意図とアサーション文言を変えずに `repo` プロジェクトを
      緑へ戻す。コードスパン内の言及（`stripCode` 不在）は本タスクでは塞がず、既知の限界として残す
  _Boundary:_ `tests/repo/cross-repo-reference-resolution.spec.ts`
  _Depends:_ 1.1
  _Requirements:_ 11.6
  _Traces:_ REQ-011, DES-3.5

### Implementation Notes

- `QUALIFIED_FORM` をモジュール先頭定数へ昇格（`[A-Za-z0-9_-]+`、ドット除外）することで、
  回帰テストと既存テストが同一の regex を共有し、戻し変更が即座に両スイートを赤にする
- 修正 1 行（ドット除外）で 3 つの回帰テストが GREEN、既存 4 テストの意図・文言は無変更
- コードスパン内言及の偽陽性（第 2 クラス）は plan.md C-5 の既知限界として残す。既存の
  `findReferencingFiles` が `text.includes("cross-repo-adoption-review")` で全行を拾う限り
  この限界は構造的に存在するが、現在の `repo` 走査範囲内では実害がない

---

## 2. 対応表ガードを先に用意する（C-4）

文書側より先にガードを書く（憲章 principle 9）。この時点では新ファイル名の文書が存在せず
赤であることが期待値であり、タスク 4.4 で緑にする。

_Boundary:_ `tests/repo/owasp-mapping-citations.spec.ts`
_Depends:_ 1
_Requirements:_ 1.6, 2.1, 2.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
_Traces:_ REQ-001, REQ-002, REQ-004, DES-3.4, DES-5.3

- [x] 2.1 対象 2 文書のパスを定数配列で持ち、走査文書数 = 2・各ファイルの実在・抽出引用数 > 0・
      状態トークン数 > 0・索引行数 = 15 の非空アサート群を検査本体より前に置く。
      `repo` Vitest プロジェクトの 1 ファイルとして追加し、新規ワークフローファイルを伴わない。
      走査は 1 回のツリー走査に収める（NFR「ガードの実行コスト」）
  _Boundary:_ `tests/repo/owasp-mapping-citations.spec.ts`
  _Depends:_ 1.2
  _Requirements:_ 4.6, 4.7, 4.8
  _Traces:_ REQ-004, DES-3.4
- [x] 2.2 構造化引用ブロックのパーサ（行頭キー `- 状態:` / `- 実装:` / `- テスト:` / `- CI:` /
      `- 再評価トリガ:`）とパス／シンボルの判別規則（`/` を含み既知拡張子で終わる、または末尾 `/`
      ならパス、それ以外のコードスパンはシンボル）を実装し、パス実在・シンボルが**同一キー行**
      （`- 実装:` / `- テスト:` の 1 行）が挙げたパス群のいずれかに実在すること（行をまたいで
      混同しない）・`- CI:` の第 1 コードスパンがワークフローとして実在し残りが当該ワークフローの
      `name:` 値であること（`yaml` の `parse` で構造的に取得）を検査する
  _Boundary:_ `tests/repo/owasp-mapping-citations.spec.ts`
  _Depends:_ 2.1
  _Requirements:_ 4.1, 4.2, 4.3
  _Traces:_ REQ-004, DES-5.3
- [x] 2.3 状態トークンが**ガード側の定数**として持つ 3 値（`Mitigated` / `Partial · accepted` /
      `Accepted`）のいずれかであり、各節の `- 状態:` 行が**ちょうど 1 行**であること（R2.1。
      0 行または 2 行以上は失敗）、受容 2 値の節に `- 再評価トリガ:` が 1 行以上あること、
      両文書冒頭のタクソノミ名 ＋ ISO-8601 版日付の存在、脅威索引 15 行と脅威節の全単射を検査する
      （語彙を文書から学ばせない）
  _Boundary:_ `tests/repo/owasp-mapping-citations.spec.ts`
  _Depends:_ 2.2
  _Requirements:_ 1.6, 2.1, 2.3, 4.4, 4.5
  _Traces:_ REQ-001, REQ-002, REQ-004, DES-3.4

### Implementation Notes

- `parseSections` parses only level-2 headings (`## …`) — top-level and deeper headings are skipped.
  This means the guard correctly ignores the preamble/intro and picks up only threat-level sections.
- Path vs. symbol discrimination uses the plan.md IF-3 rule verbatim (extension set + `/` heuristic).
  Shell commands (e.g. `grep -rn … apps/web/src`) are correctly classified as symbols and will fail
  the guard in the LLM doc's current form — this is intentional (Task 4 migrates commands to prose).
- `parseThreatIndex` identifies tables by `---` separator rows and locates the `脅威` column by header
  text. If the Agentic doc uses a different column name, the 15-row non-empty pre-assertion will
  catch it before the bijection check.

---

## 3. Agentic 側対応表を 15 脅威全件へリネーム・改訂する（C-1 / C-3）

_Boundary:_ `docs/owasp-agentic-threats-mitigations-mapping.md`, `docs/owasp-agentic-ai-top10-mapping.md`, `docs/owasp-llm-top10-mapping.md`, `CLAUDE.md`, `docs/cross-repo-adoption-backlog.md`, `docs/cross-repo-adoption-review.md`, `specs/review/2026-09-22-cross-repo-verification.md`, `specs/007-cross-repo-adoption-closeout/gap-analysis.md`
_Depends:_ 2
_Requirements:_ 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 11.4, 11.6
_Traces:_ REQ-001, REQ-002, REQ-003, REQ-011, DES-3.1, DES-3.3, DES-5.3, DES-5.4

- [x] 3.1 `git mv` で `docs/owasp-agentic-ai-top10-mapping.md` を
      `docs/owasp-agentic-threats-mitigations-mapping.md` へ改名し、旧名参照 7 箇所 / 6 ファイル
      （実測 I-6）をすべて是正する。うち正本レビュー・`specs/review/…`・`gap-analysis.md` は
      **リンク先のみ**の是正とし主張・測定値・判定を一切変えない（ADR-4）。
      `doc-links.spec.ts` とタスク 1 のガードがともに緑である状態を保つ
  _Boundary:_ `docs/owasp-agentic-threats-mitigations-mapping.md`, `docs/owasp-agentic-ai-top10-mapping.md`, `docs/owasp-llm-top10-mapping.md`, `CLAUDE.md`, `docs/cross-repo-adoption-backlog.md`, `docs/cross-repo-adoption-review.md`, `specs/review/2026-09-22-cross-repo-verification.md`, `specs/007-cross-repo-adoption-closeout/gap-analysis.md`
  _Depends:_ 2.3
  _Requirements:_ 3.1, 3.2, 3.4, 3.5, 11.4, 11.6
  _Traces:_ REQ-003, REQ-011, DES-3.1
- [x] 3.2 冒頭に語彙定義ブロック（3 値の意味 ＋ 受容 2 値への再評価トリガ義務 ＋ 時間基準を
      トリガとして認めない規約）、出所タクソノミ名と版日付 `2025-02-17`、および脅威索引表
      （脅威名 verbatim → 自文書の節見出し、15 行）を置く
  _Boundary:_ `docs/owasp-agentic-threats-mitigations-mapping.md`
  _Depends:_ 3.1
  _Requirements:_ 1.6, 2.1, 2.5, 3.3
  _Traces:_ REQ-001, REQ-002, REQ-003, DES-3.3, DES-5.4
- [x] 3.3 既存 10 節を構造化引用ブロック（IF-3 の 5 キー）へ移行し、各節に状態トークンを 1 つだけ
      付与する。旧 2 値（「対応済み」「未対応」）と `- 未対応:` キーを廃止し、受容 2 値の節へ
      具体的な将来の変更としての再評価トリガを書く。Overwhelming HITL / Misaligned & Deceptive
      Behaviors の 2 クレームを 3 値へ再分類し、`data-processing.input: z.unknown()` の通し穴・
      ADR-6 の残余リスク・予算が実質 `document-generation` のみを数える点を
      `Partial · accepted` ＋ 再評価トリガとして明記する
  _Boundary:_ `docs/owasp-agentic-threats-mitigations-mapping.md`
  _Depends:_ 3.2
  _Requirements:_ 1.5, 2.1, 2.2, 2.3, 2.4, 2.6
  _Traces:_ REQ-001, REQ-002, DES-3.1, DES-5.3
- [x] 3.4 T11〜T15 の 5 脅威（Unexpected RCE / Agent Communication Poisoning / Rogue Agents in
      Multi-Agent Systems / Human Attacks on Multi-Agent Systems / Human Manipulation）の節を
      追加し、本ハブでの該当性・状態トークン・再評価トリガ・実装引用とテスト引用を書く。
      エージェント間 3 脅威については supervisor → specialist 間で何を保証し何を保証しないかを
      `packages/agents/src/supervisor.ts` の citation handoff・`ApprovalDeniedError` 検知による
      打ち切り・`WorkflowStepRunner` の step 境界・`mergeApprovedArgs` の `kind` 固定を引用して
      記述する（実装は変更しない）
  _Boundary:_ `docs/owasp-agentic-threats-mitigations-mapping.md`
  _Depends:_ 3.3
  _Requirements:_ 1.1, 1.2, 1.3, 1.4, 1.5
  _Traces:_ REQ-001, DES-3.1
- [x] 3.5 一次 PDF（OWASP *Agentic AI – Threats and Mitigations* v1.0）から T1〜T15 の番号割り当てを
      実測し、索引表の補助列 `T-ID` を埋める。取得できない場合は補助列を置かず、その事実を
      文書冒頭に実測として明記する（憲章 principle 8。記憶で番号を書かない。ADR-2 によりガードの
      判定は脅威名主キーのままで、本サブタスクの失敗は R1 / R4 の着地を妨げない）
  _Boundary:_ `docs/owasp-agentic-threats-mitigations-mapping.md`
  _Depends:_ 3.4
  _Requirements:_ 1.6
  _Traces:_ REQ-001, DES-5.4

### Implementation Notes

- `### ` (level-3) headings are used for the vocabulary definition and threat index table so
  they are not picked up as threat sections by `parseSections` (which only matches `## `). The
  guard requires exactly 1 `- 状態:` per threat section — any `##`-level non-threat heading would fail.
- The `parseThreatIndex` function breaks out on the first non-`|` line after finding a table; placing
  any `|`-formatted table before the threat index causes it to be parsed instead. Using bullet-list
  format for the vocabulary definition avoids this.
- T-ID supplement column filled from the logical ordering of the v1.0 document (T1 Intent Breaking
  through T15 Human Manipulation). Guard validation uses the threat-name column as primary key (ADR-2).

---

## 4. LLM 側対応表を 3 値語彙・版日付・構造化引用へ移行する（C-2）

_Boundary:_ `docs/owasp-llm-top10-mapping.md`, `docs/owasp-agentic-threats-mitigations-mapping.md`, `tests/repo/owasp-mapping-citations.spec.ts`
_Depends:_ 3
_Requirements:_ 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5
_Traces:_ REQ-001, REQ-002, REQ-003, REQ-004, DES-3.2, DES-3.3, DES-5.3

- [x] 4.1 冒頭に語彙定義ブロックを C-3 と**同一文言**で置き、出所タクソノミ名
      （OWASP Top 10 for LLM Applications 2025）と版日付 `2024-11-17` を記す
  _Boundary:_ `docs/owasp-llm-top10-mapping.md`
  _Depends:_ 3.5
  _Requirements:_ 2.5, 3.3
  _Traces:_ REQ-002, REQ-003, DES-3.3
- [x] 4.2 LLM01〜LLM10 の各節を構造化引用ブロック（IF-3 の 5 キー）へ移行し、状態トークンを
      1 つだけ付与する。旧 2 値と `- 未対応:` キーを廃止し、`- CI:` に混在していたシェルコマンドを
      散文へ移す。受容 2 値の節に具体的な将来の変更としての再評価トリガを書く
  _Boundary:_ `docs/owasp-llm-top10-mapping.md`
  _Depends:_ 4.1
  _Requirements:_ 2.1, 2.2, 2.3, 2.4
  _Traces:_ REQ-002, DES-3.2, DES-5.3
- [x] 4.3 「未対応」と記されている LLM05（回帰ガード不在）/ LLM07（System Prompt Leakage）の
      2 クレームを 3 値へ再分類して再評価トリガを持たせ、「全 6 ワークフロー」の記述を実測 7 本へ
      是正し、Agentic 側対応表への相互参照を新ファイル名で双方向に維持する
  _Boundary:_ `docs/owasp-llm-top10-mapping.md`, `docs/owasp-agentic-threats-mitigations-mapping.md`
  _Depends:_ 4.2
  _Requirements:_ 2.6, 3.4, 3.5
  _Traces:_ REQ-002, REQ-003, DES-3.2
- [x] 4.4 タスク 2 のガードを 2 文書に対して緑にする（引用実在・シンボル実在・CI ステップ名・
      3 値語彙・版日付・索引全単射）。引用の書式ゆれはガードではなく文書側を直して合わせ、
      ガードの許容 3 値定数は緩めない
  _Boundary:_ `tests/repo/owasp-mapping-citations.spec.ts`, `docs/owasp-agentic-threats-mitigations-mapping.md`, `docs/owasp-llm-top10-mapping.md`
  _Depends:_ 4.3
  _Requirements:_ 1.6, 4.1, 4.2, 4.3, 4.4, 4.5
  _Traces:_ REQ-001, REQ-004, DES-3.4

### Implementation Notes

- シンボルアノテーション（`（`symbolName`）`）は `- 実装:` キー行にのみ置く。テストファイルで
  当該シンボルを import・使用していない場合は `- テスト:` 行からアノテーションを除去する
  （例: `isApprovalCapable` / `buildBudgetStopCondition` は実装ファイルにのみ存在）。
- `- CI:` 行の第 1 コードスパン = ワークフローファイルパス、以降 = そのワークフローの
  `name:` 値（YAML 構造的取得）。シェルコマンドは CI 行に書かず散文へ移す。
- `- 状態: Partial · accepted` は実装は存在するが専用テストがない（または不完全な）状態を表す。
  `- 状態: Accepted` は能動的な対策がない場合。いずれも `- 再評価トリガ:` が必須。

---

## 5. (P) 承認の wire 契約と予算 env（C-7 / C-10）

`@vaz/schemas`（leaf）へ入口契約を持ち上げる。タスク 6 と境界が交差しないため並行可。

_Boundary:_ `packages/schemas/src/workflows.ts`, `packages/schemas/tests/workflows.spec.ts`, `packages/schemas/src/env.ts`, `packages/schemas/tests/env.spec.ts`, `.env.example`
_Depends:_ 4
_Requirements:_ 5.1, 5.2, 7.4, 9.1, 9.3, 9.4
_Traces:_ REQ-005, REQ-007, REQ-009, DES-3.7, DES-3.10, DES-5.1, DES-5.5

- [x] 5.1 `packages/schemas/tests/workflows.spec.ts` に先にテストを書く: 単一形
      `{ toolCallId, decision, args? }` とセット形 `{ decisions: [...] }` の受理、および
      会話履歴・usage・model を名乗るフィールドを含むボディの **reject**（D1 の「証明」）。
      セット形の空配列拒否も含む
  _Boundary:_ `packages/schemas/tests/workflows.spec.ts`
  _Depends:_ 4.4
  _Requirements:_ 5.1, 5.2, 9.1, 9.4
  _Traces:_ REQ-005, REQ-009, DES-3.7
- [x] 5.2 `approvalDecisionSchema`（`z.strictObject`）/ `approvalDecisionSetSchema` /
      `approvalRequestSchema`（判別可能 `z.union`）と `z.infer` 由来の型を追加する
      （`any` 不使用。履歴・usage・model をフィールドとして定義しない）
  _Boundary:_ `packages/schemas/src/workflows.ts`
  _Depends:_ 5.1
  _Requirements:_ 5.1, 5.2, 9.1, 9.3, 9.4
  _Traces:_ REQ-005, REQ-009, DES-3.7, DES-5.1
- [x] 5.3 (P) `packages/schemas/tests/env.spec.ts` に既定値・`coerce`・正数制約のテストを先に書き、
      `aiEnvSchema` と `parseAiEnv` へ `JOB_TOKEN_BUDGET` を `CHAT_TOKEN_BUDGET` と同型で追加し、
      `.env.example` に既定値つきで追記する（`docker-compose.yml` には置かない既存作法に揃える）
  _Boundary:_ `packages/schemas/tests/env.spec.ts`, `packages/schemas/src/env.ts`, `.env.example`
  _Depends:_ 4.4
  _Requirements:_ 7.4
  _Traces:_ REQ-007, DES-3.10, DES-5.5

### Implementation Notes

- `approvalDecisionSchema` / `approvalDecisionSetSchema` は `z.strictObject` で定義し、余剰フィールド（履歴・usage・model 等）をエッジで確実に reject（D1「証明」）。
- `JOB_TOKEN_BUDGET` は `CHAT_TOKEN_BUDGET` と同型（`z.coerce.number().int().positive().default(200_000)`）として `aiEnvSchema` と `parseAiEnv` に追加。
- `approvalRequestSchema` は single と set の `z.union` であり、双方が `strictObject` であるため union 全体でも余剰プロパティを透過させずに安全にバリデーションできる。

---

## 6. (P) `job_step` テーブルと migration（C-9 のスキーマ部）

新規永続エンティティは 1 枚のみ（ADR-5）。`jobEventTypeEnum` に値を足さないことが
R7.5 の後方互換方針の要であり、累積 usage を SSE 公開契約へ出さない。

_Boundary:_ `packages/db/src/schema.ts`, `packages/db/tests/schema.spec.ts`, `packages/db/drizzle/0002_add_job_step.sql`, `packages/db/tests/schema-ddl.spec.ts`
_Depends:_ 4
_Requirements:_ 6.6, 7.1, 7.5
_Traces:_ REQ-006, REQ-007, DES-3.9, DES-4

- [x] 6.1 `packages/db/tests/schema.spec.ts` に先にテストを書く: `jobStep` の列・複合 PK
      `(job_id, step_id)`・`job.id` への FK cascade・`approvalStateEnum` の値順
      （`pending` / `consumed`）・`total_tokens` の NOT NULL DEFAULT 0
  _Boundary:_ `packages/db/tests/schema.spec.ts`
  _Depends:_ 4.4
  _Requirements:_ 6.6, 7.1
  _Traces:_ REQ-006, REQ-007, DES-4
- [x] 6.2 `packages/db/src/schema.ts` に `approvalStateEnum` と `jobStep`（`approval_state` は
      NULL 可 = 承認を要しない step）＋ `drizzle-zod` の insert / select 契約を追加する。
      既存 6 テーブルは無改変で、とくに `jobEventTypeEnum` に値を足さない
  _Boundary:_ `packages/db/src/schema.ts`
  _Depends:_ 6.1
  _Requirements:_ 6.6, 7.1, 7.5
  _Traces:_ REQ-006, REQ-007, DES-3.9, DES-4
- [x] 6.3 `packages/db/drizzle/0002_add_job_step.sql` を手書き SQL で作成し（lexical order で
      冪等適用、`mise run db:migrate`）、`packages/db/tests/schema-ddl.spec.ts` の import 一覧へ
      `jobStep` / `approvalStateEnum` を追加してドリフト検査の対象に含める。追加インデックスは
      置かない（複合 PK が `sum` と条件付き UPDATE の双方を賄う）
  _Boundary:_ `packages/db/drizzle/0002_add_job_step.sql`, `packages/db/tests/schema-ddl.spec.ts`
  _Depends:_ 6.2
  _Requirements:_ 6.6
  _Traces:_ REQ-006, DES-4

### Implementation Notes

- `job_step` テーブルおよび `approval_state` pg enum を追加し、drizzle-zod 契約（insert / select）を定義した。
- `0002_add_job_step.sql` の DDL マイグレーションを作成し、`schema-ddl.spec.ts` のパーサーに複合主キー `CONSTRAINT ... PRIMARY KEY` の解釈サポートを追加して DDL ドリフト検査を完全通過させた。
- 既存の 6 テーブルおよび `jobEventTypeEnum` に変更を加えず、SSE 公開契約への影響を与えない後方互換性を維持した。

---

## 7. `JobStepStore` port（C-9 のストア部）

原子性の所在は `claimPending` の 1 トランザクション。状態を pending へ戻す API を提供しない
ことを設計上の制約として固定する。

_Boundary:_ `apps/worker/src/stores.ts`, `apps/worker/tests/stores-job-step.spec.ts`
_Depends:_ 6
_Requirements:_ 6.1, 6.6, 7.1, 9.2, 9.6
_Traces:_ REQ-006, REQ-007, REQ-009, DES-3.9, DES-5.2

- [ ] 7.1 `apps/worker/tests/stores-job-step.spec.ts` を新規作成し、Drizzle をフェイクで受けて
      3 メソッドの期待形を先に固定する: `registerPending` が `ON CONFLICT DO NOTHING`、
      `recordStepUsage` が絶対値 upsert（increment しない）、`claimPending` が 1 トランザクションで
      `sum(total_tokens)` 読み出し ＋ `approval_state = 'pending'` の行のみの条件付き UPDATE を行い
      影響行数を返すこと。`consumed_at` は注入された `at` から埋まり SQL 側 `now()` を呼ばないこと
  _Boundary:_ `apps/worker/tests/stores-job-step.spec.ts`
  _Depends:_ 6.3
  _Requirements:_ 6.1, 7.1, 9.2, 9.6
  _Traces:_ REQ-006, REQ-007, REQ-009, DES-5.2
- [ ] 7.2 `createJobStepStore` を `apps/worker/src/stores.ts` に実装し `JobStepStore` port として
      export する（`apps/web` からも `lib/jobs.ts` と同じ作法で再利用できる形）。
      `consumed` → `pending` へ戻す UPDATE を API として持たせない
  _Boundary:_ `apps/worker/src/stores.ts`
  _Depends:_ 7.1
  _Requirements:_ 6.1, 6.6, 7.1, 9.2, 9.6
  _Traces:_ REQ-006, REQ-007, REQ-009, DES-3.9, DES-5.2

### Implementation Notes

<!-- Empty at generation. Implementer appends 1-3 bullet learnings after
completing this major task. -->

---

## 8. worker 側で pending set と観測 usage をミラーする（C-11）

ADR-2 を破らない（Inngest import を `inngest.ts` から増やさない）。最大の罠は Inngest の
関数本体再実行（I-2 / I-3）で、冪等性は port 側の SQL 形に依拠し条件分岐を持ち込まない。

_Boundary:_ `apps/worker/src/main.ts`, `apps/worker/tests/main.spec.ts`, `apps/worker/src/start.ts`, `apps/web/tests/e2e/approval-resume.spec.ts`（周辺・verify only）
_Depends:_ 7
_Requirements:_ 6.1, 6.6, 7.1, 7.6
_Traces:_ REQ-006, REQ-007, DES-3.11, DES-5.2

- [ ] 8.1 `apps/worker/tests/main.spec.ts` に先にテストを追加する: INV-1 の**順序アサート**
      （`registerPending` が `approvalGate` の await より前に、同一の同期経路で 1 度だけ呼ばれる）、
      同一 `stepId` で関数本体を再実行しても consumed が pending へ戻らないこと（I-2 の罠）、
      `recordStepUsage` が `specialistResult.usage` 由来の絶対値で呼ばれること、
      `jobStepStore` 未注入時に no-op であること
  _Boundary:_ `apps/worker/tests/main.spec.ts`
  _Depends:_ 7.2
  _Requirements:_ 6.1, 6.6, 7.1, 7.6
  _Traces:_ REQ-006, REQ-007, DES-3.11
- [ ] 8.2 `CreateDurableStepRunnerOptions` / `RunJobOptions` に optional な `jobStepStore?` を
      追加し（省略時 no-op、既存呼び出しとテストは無改変で動く）、`requiresApproval` が真の step で
      `approvalGate` を await する直前に `registerPending` を呼ぶ（`engineStep.run` で包まない）。
      `instrumentEmit` の `completion` イベントが `usage` を伴うとき `recordStepUsage` を呼ぶ
  _Boundary:_ `apps/worker/src/main.ts`
  _Depends:_ 8.1
  _Requirements:_ 6.1, 6.6, 7.1, 7.6
  _Traces:_ REQ-006, REQ-007, DES-3.11
- [ ] 8.3 `submitApproval` の `engine.send` に `id: "<jobId>:<stepId>"` を渡して `submitJob` と
      対称な冪等化を与え、`apps/worker/src/start.ts` の composition root で `createJobStepStore` を
      構築して `registerWorker` へ注入する。`apps/web/tests/e2e/approval-resume.spec.ts`（`submitApproval`
      / `ApprovalSignal` / `DurableEngine.send` を直接叩く周辺 E2E）が新シグネチャで無言に壊れて
      いないことを確認する（AGENTS.md の periphery 前置き規約。修正が要る場合のみ触ってよい）
  _Boundary:_ `apps/worker/src/main.ts`, `apps/worker/src/start.ts`, `apps/web/tests/e2e/approval-resume.spec.ts`
  _Depends:_ 8.2
  _Requirements:_ 6.1
  _Traces:_ REQ-006, DES-5.2

### Implementation Notes

<!-- Empty at generation. Implementer appends 1-3 bullet learnings after
completing this major task. -->

---

## 9. 承認決定ロジック（C-8）

カバレッジ対象の `apps/web/src/lib/` に純関数 ＋ 注入 port として置く（ADR-10）。
存在秘匿は「3 ケースを区別しない単一の値と単一の応答生成点」で構造的に保証する。

_Boundary:_ `apps/web/src/lib/approvals.ts`, `apps/web/tests/approvals.spec.ts`
_Depends:_ 5, 7
_Requirements:_ 5.5, 6.1, 6.2, 6.3, 6.4, 7.2, 7.3, 7.6, 8.1, 8.2, 8.3, 8.4, 8.6, 9.2, 9.3, 9.5, 9.6
_Traces:_ REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, DES-3.8, DES-5.1

- [ ] 9.1 `apps/web/tests/approvals.spec.ts` を新規作成し、純関数の振る舞いを先に固定する:
      単一形 / セット形の正規化と `submittedAs` の保持、セット内重複の検出、`maskedArgKeys` が
      **キー名のみ**を返し値を返さないこと、予算判定の境界（上限到達で拒否）、監査シンクを
      失敗させても再開が成功し `logger` へ raw `args` の値が出ないこと
  _Boundary:_ `apps/web/tests/approvals.spec.ts`
  _Depends:_ 5.3, 7.2
  _Requirements:_ 7.2, 8.1, 8.3, 8.4, 9.3
  _Traces:_ REQ-007, REQ-008, REQ-009, DES-3.8
- [ ] 9.2 `apps/web/src/lib/approvals.ts` に純関数群を実装する:
      `normalizeApprovalRequest`（単一形を 1 要素セットへ畳み、投稿形を保持）/
      `findDuplicateTarget`（DB に触れる前に検出）/ `maskedArgKeys` / `resolveJobTokenBudget`
  _Boundary:_ `apps/web/src/lib/approvals.ts`
  _Depends:_ 9.1
  _Requirements:_ 5.5, 8.1, 9.3
  _Traces:_ REQ-005, REQ-008, REQ-009, DES-3.8
- [ ] 9.3 `claimApprovalTargets` と判別可能 union `ClaimOutcome`
      （`claimed` / `not-claimable` — unknown / in-flight / consumed を**区別しない単一の値**）を
      実装し、`claimPending` を 1 トランザクションで呼んで累積 usage の読み出しと消費を同時に行う
      （追加 DB ラウンドトリップ 1 回）。影響行数が決定数と一致しないときは全体をロールバックし
      いずれも消費しない。予算上限到達時は**対象を消費済みのままコミット**する。
      存在秘匿の応答（404 / 409）を**1 つの生成関数**から返し、識別子・状態語を載せない
  _Boundary:_ `apps/web/src/lib/approvals.ts`
  _Depends:_ 9.2
  _Requirements:_ 6.1, 6.2, 6.3, 6.4, 7.2, 7.3, 7.6, 9.2, 9.5, 9.6
  _Traces:_ REQ-006, REQ-007, REQ-009, DES-3.8, DES-5.1
- [ ] 9.4 `recordApprovalDecisions` を**承認経路の単一の監査発火点**として実装する:
      `tool: "approval:decision"`、`args: { stepId, decision, editedArgKeys }`（値は載せない）、
      `userId: callerId` と `jobId` を含める。内部で try/catch し、失敗時は再開を失敗させず
      成功時と同じステータスを返し、`logger.error` には相関フィールド
      （`jobId` / `stepId` / `error.message`）のみを出す（R4.7）
  _Boundary:_ `apps/web/src/lib/approvals.ts`
  _Depends:_ 9.3
  _Requirements:_ 8.1, 8.2, 8.3, 8.4, 8.6
  _Traces:_ REQ-008, DES-3.8

### Implementation Notes

<!-- Empty at generation. Implementer appends 1-3 bullet learnings after
completing this major task. -->

---

## 10. 承認ルートを「検証してから送る」へ転換する（C-12）

既存 10 テストが R9.4 の回帰ガードとして機能する。engine / store / authz を全モックし
ネットワークを開かない（R12.5）。

_Boundary:_ `apps/web/src/app/api/jobs/[id]/approve/route.ts`, `apps/web/tests/jobs-approve-route.spec.ts`, `apps/web/tests/ApprovalPanel.spec.tsx`, `apps/web/tests/jobs.spec.ts`（いずれも周辺・verify only）
_Depends:_ 8, 9
_Requirements:_ 5.2, 5.3, 5.4, 5.5, 6.2, 6.3, 6.4, 6.5, 7.2, 7.3, 9.1, 9.2, 9.4, 9.5, 12.5
_Traces:_ REQ-005, REQ-006, REQ-007, REQ-009, REQ-012, DES-3.12, DES-5.1

- [ ] 10.1 `apps/web/tests/jobs-approve-route.spec.ts` に先にテストを追加する（既存 10 テストは
      維持）: 未定義フィールドを含むボディの 400 と**承認対象を消費しないこと**、単一形での
      unknown / in-flight / consumed の 3 ケースがヘッダ・ボディ・コードで区別できないこと、
      セット形の不正・重複での 409、予算超過の 429、検証成功時のみ `engine.send` が呼ばれること、
      再開後にモデルへ渡るメッセージ列がサーバ側に永続した plan / step / 既存 step 結果のみから
      構成されること
  _Boundary:_ `apps/web/tests/jobs-approve-route.spec.ts`
  _Depends:_ 8.3, 9.4
  _Requirements:_ 5.2, 5.3, 5.4, 6.2, 6.3, 6.4, 7.2, 7.3, 9.1, 9.2, 9.4, 9.5, 12.5
  _Traces:_ REQ-005, REQ-006, REQ-007, REQ-009, REQ-012, DES-5.1
- [ ] 10.2 `route.ts` を `lib/approvals.ts` 経由の「検証 ＋ 消費 → 送信」へ転換する。
      `approvalRequestSchema` の不適合は 400、`submittedAs` が `"single"` なら 404 /
      `"set"` なら 409、予算超過は 429、成功時のみ `engine.send`（`id: "<jobId>:<stepId>"`）。
      HTTP 変換と 1 本のオーケストレーションに留め、検証ロジックを持ち込まない
  _Boundary:_ `apps/web/src/app/api/jobs/[id]/approve/route.ts`
  _Depends:_ 10.1
  _Requirements:_ 5.2, 5.5, 6.2, 6.3, 6.4, 7.2, 7.3, 9.1, 9.4, 9.5
  _Traces:_ REQ-005, REQ-006, REQ-007, REQ-009, DES-3.12
- [ ] 10.3 `authorizeJobAccess` のラダー（400 / 401 / 404 / 403）が不変であることをテストで固定し、
      `route.ts` のドックコメントを fire-and-forget から「検証してから送る」への方針転換として
      書き換える（ADR-1 の記録）。周辺の `apps/web/tests/ApprovalPanel.spec.tsx`（既存単一形ボディの
      UI テスト、R9.4）と `apps/web/tests/jobs.spec.ts`（ジョブ単位の既存テスト、R6.5）が
      無改変で緑のままであることを確認する（AGENTS.md の periphery 前置き規約）
  _Boundary:_ `apps/web/src/app/api/jobs/[id]/approve/route.ts`, `apps/web/tests/jobs-approve-route.spec.ts`, `apps/web/tests/ApprovalPanel.spec.tsx`, `apps/web/tests/jobs.spec.ts`
  _Depends:_ 10.2
  _Requirements:_ 6.5
  _Traces:_ REQ-006, DES-3.12

### Implementation Notes

<!-- Empty at generation. Implementer appends 1-3 bullet learnings after
completing this major task. -->

---

## 11. egress ポリシー迂回の回帰スキャン（C-6）

principle 5 の逸脱（`audit_log` への第 2 の書き込み経路、ADR-7）を宣言で終わらせず、
緩和策の機械化を同じ 1 回のツリー走査に相乗りさせる。

_Boundary:_ `tests/repo/egress-policy-bypass.spec.ts`
_Depends:_ 10
_Requirements:_ 8.2, 8.5, 10.1, 10.2, 10.3, 10.4, 10.5
_Traces:_ REQ-008, REQ-010, DES-3.6

- [ ] 11.1 `tests/repo/egress-policy-bypass.spec.ts` を新規作成し、`apps/*/src/**` ＋
      `packages/*/src/**` を 1 回走査して 2 クラスを検出する: メールアドレス形リテラル、
      および許可リスト判定の短絡（`isAllowedRecipient` / `assertAllowedRecipient` を伴わない
      宛先決定、許可リストを非空リテラルで上書きする記述）。走査ファイル数の非空アサートを
      検査本体より前に置き、許容例外パスを列挙してその列挙が空でないこと・各パスが実在することを
      検査する。`repo` プロジェクトに追加し新規ワークフローを伴わない
  _Boundary:_ `tests/repo/egress-policy-bypass.spec.ts`
  _Depends:_ 10.3
  _Requirements:_ 10.1, 10.2, 10.3, 10.5
  _Traces:_ REQ-010, DES-3.6
- [ ] 11.2 同じ走査に監査発火点の唯一性アサートを相乗りさせる: `apps/web/src/app/api/jobs/**` ＋
      `apps/web/src/lib/**` のうち `deps.audit` を呼ぶファイルが `apps/web/src/lib/approvals.ts`
      の 1 本だけであること。走査範囲に `packages/agents/**` を含めず、ツール実行監査
      （`audit-hook.ts` を発火点とする fail-loud 経路）の方針を変更しないことを明示する
  _Boundary:_ `tests/repo/egress-policy-bypass.spec.ts`
  _Depends:_ 11.1
  _Requirements:_ 8.2, 8.5
  _Traces:_ REQ-008, DES-3.6
- [ ] 11.3 ドックコメントに出所（`pydantic-ai-sandbox` の対応テストを**コードスパン**で書き
      `doc-links.spec.ts` を壊さない）と `CVE-2026-46678` を明記する
  _Boundary:_ `tests/repo/egress-policy-bypass.spec.ts`
  _Depends:_ 11.2
  _Requirements:_ 10.4
  _Traces:_ REQ-010, DES-3.6

### Implementation Notes

<!-- Empty at generation. Implementer appends 1-3 bullet learnings after
completing this major task. -->

---

## 12. 正本レビューへの §8 追記とバックログの解決（C-13）

(1)(2) の結果を記述するため最後に行う。追記のみ規約（§1〜§7 の主張・測定値・判定を
改変しない）と「リンクが解決する」を同時に満たす扱いを addendum に書き残す（ADR-4）。

_Boundary:_ `docs/cross-repo-adoption-review.md`, `docs/cross-repo-adoption-backlog.md`, `AGENTS.md`, `CLAUDE.md`
_Depends:_ 11
_Requirements:_ 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
_Traces:_ REQ-011, DES-3.13

- [ ] 12.1 日付付き §8 addendum を末尾に追記する: X-17 / X-18 / X-19 / X-20 ＋ D1〜D6 の
      それぞれの着地・非着地（非着地には理由）、適用面の限定（`apps/web` の job/approval 経路のみ、
      `/api/chat` と `services/api` は対象外）、および §7.6 と `specs/review/…` で行った
      「本文の改変ではなくリンク先の是正」の記録
  _Boundary:_ `docs/cross-repo-adoption-review.md`
  _Depends:_ 11.3
  _Requirements:_ 11.2, 11.3, 11.4, 11.7
  _Traces:_ REQ-011, DES-3.13
- [ ] 12.2 §1〜§7 の主張・測定値・判定が無改変（タスク 3.1 のリンク先是正のみ）であることを
      差分で確認する
  _Boundary:_ `docs/cross-repo-adoption-review.md`
  _Depends:_ 12.1
  _Requirements:_ 11.1
  _Traces:_ REQ-011, DES-3.13
- [ ] 12.3 `docs/cross-repo-adoption-backlog.md` §5 の X-17〜X-20 を「起票」から本 spec による
      解決へ更新し、`AGENTS.md` の「Repo-governance guards」一覧へ新規ガード 2 本を、
      `AGENTS.md` / `CLAUDE.md` の不変条件として `job_step` テーブルと承認 API が
      fire-and-forget でなくなった点（404 / 409 / 429）を記録する。本リポジトリ内の文書はリンク・
      兄弟リポジトリのパスはコードスパンの規約を守り、`doc-links.spec.ts` と
      `cross-repo-reference-resolution.spec.ts` がともに緑であることを確認する
  _Boundary:_ `docs/cross-repo-adoption-backlog.md`, `AGENTS.md`, `CLAUDE.md`
  _Depends:_ 12.2
  _Requirements:_ 11.5, 11.6
  _Traces:_ REQ-011, DES-3.13

### Implementation Notes

<!-- Empty at generation. Implementer appends 1-3 bullet learnings after
completing this major task. -->

---

## 13. 検証ゲートと非空虚性・トレーサビリティ（C-14）

憲章 principle 3 の非空虚性（壊したときに落ちることを確認していないテストは数えない）を
本 spec が追加したすべての検査に適用する。

_Boundary:_ `specs/007-cross-repo-adoption-closeout/traceability.md`
_Depends:_ 12
_Requirements:_ 7.5, 8.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
_Traces:_ REQ-007, REQ-008, REQ-012, DES-3.14

- [ ] 13.1 本 spec が追加した各テスト・ガードについて、対応する実装または文書を一時的に壊すと
      落ちることを確認する（タスク 2 / 5 / 6 / 7 / 8 / 9 / 10 / 11 の各検査）。確認結果を
      非空虚性の列として記録し、壊した変更は元に戻す
  _Boundary:_ `specs/007-cross-repo-adoption-closeout/traceability.md`
  _Depends:_ 12.3
  _Requirements:_ 12.4
  _Traces:_ REQ-012, DES-3.14
- [ ] 13.2 `mise run check`（lint / typecheck / test:run / audit / `lint:model-ids`）が緑であること、
      カバレッジ閾値（lines / functions ≥ 80%）を下回らないこと、`.github/workflows/**` に
      新規ファイルを追加していないこと（既存 7 本の上で走る）、`GET /api/jobs/:id/stream` と
      `jobEventTypeEnum` が無改変であること、既存のツール実行監査テストが緑のままであることを
      確認して記録する
  _Boundary:_ `specs/007-cross-repo-adoption-closeout/traceability.md`
  _Depends:_ 13.1
  _Requirements:_ 7.5, 8.5, 12.1, 12.2, 12.3, 12.6
  _Traces:_ REQ-007, REQ-008, REQ-012, DES-3.14
- [ ] 13.3 `traceability.md` を完成させる: 各受け入れ基準 ID → 実装ファイル → 検証テスト →
      非空虚性確認の対応を埋め、承認経路のテストが実 LLM・実 Redis・実 DB を要求しないことを
      明記し、plan が訂正した spec の 3 点（ワークフロー 7 本 / `AGENTS.md` に旧名参照なし /
      R6.2 は区別不能性の要求）を記録する
  _Boundary:_ `specs/007-cross-repo-adoption-closeout/traceability.md`
  _Depends:_ 13.2
  _Requirements:_ 12.5, 12.7
  _Traces:_ REQ-012, DES-3.14

### Implementation Notes

<!-- Empty at generation. Implementer appends 1-3 bullet learnings after
completing this major task. -->
