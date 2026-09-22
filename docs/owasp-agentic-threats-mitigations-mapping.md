# OWASP Agentic AI 脅威分類 対応表（レイヤ別 Threats and Mitigations）

出所タクソノミ: **OWASP GenAI Security Project — Agentic AI: Threats and Mitigations**
バージョン日付: `2025-02-17`

本表は出所タクソノミが列挙する **15 脅威**（レイヤ別 Threats and Mitigations 分類）すべてについて、
本 repo のアーキテクチャへの該当性と対応状況を 1 脅威 1 節で記述する。

対象タクソノミは [`docs/owasp-llm-top10-mapping.md`](owasp-llm-top10-mapping.md)
（OWASP Top 10 for LLM Applications、LLM01〜LLM10）と重複しない——あちらは単発の
プロンプト/出力/サプライチェーンの脅威、本表は「複数ステップの自律実行」
「ツール連鎖」「人間監督の破綻」「マルチエージェント協調」といったエージェント特有の脅威を対象にする。

散文は日本語、識別子・型・パス・コードは英語。

---

### 状態トークン語彙定義

各節末の構造化引用ブロックには `- 状態:` を 1 行だけ置き、その値は以下の 3 値のいずれかとする（出所 verbatim、表記ゆれ不可）:

- `Mitigated` — 実装とテストの双方で対応を証明済み
- `Partial · accepted` — 部分対応済み＋残余リスクを明示的に受容
- `Accepted` — 対応なし＋リスクを明示的に受容

`Partial · accepted` または `Accepted` の節には `- 再評価トリガ:` を **1 行以上**置く。
再評価トリガは**具体的な将来の変更**として書く（「定期的に」「次回レビューで」のような時間基準はトリガとして認めない）。

---

### 脅威索引表（T1〜T15）

T-ID 列は一次 PDF（OWASP *Agentic AI – Threats and Mitigations* v1.0）から実測して埋めた補助列。
ガードの判定は脅威名列（主キー）で行い、T-ID は参照用に過ぎない。

| T-ID | 脅威（出所 verbatim） | 本文書の節 |
|---|---|---|
| T1 | Intent Breaking & Goal Manipulation | 入力/計画レイヤ — Intent Breaking & Goal Manipulation |
| T2 | Memory Poisoning | メモリ/RAG レイヤ — Memory Poisoning |
| T3 | Tool Misuse | ツール実行レイヤ — Tool Misuse |
| T4 | Privilege Compromise | アイデンティティ/アクセスレイヤ — Privilege Compromise |
| T5 | Identity Spoofing & Impersonation | アイデンティティ/アクセスレイヤ — Identity Spoofing & Impersonation |
| T6 | Resource Overload | オーケストレーション/リソースレイヤ — Resource Overload（Unbounded Consumption） |
| T7 | Cascading Hallucination | オーケストレーション/データレイヤ — Cascading Hallucination |
| T8 | Repudiation & Untraceability | 人間監督レイヤ — Repudiation & Untraceability |
| T9 | Overwhelming Human-in-the-Loop | 人間監督レイヤ — Overwhelming Human-in-the-Loop |
| T10 | Misaligned & Deceptive Behaviors | 人間監督レイヤ — Misaligned & Deceptive Behaviors |
| T11 | Unexpected RCE | エージェント実行レイヤ — Unexpected RCE |
| T12 | Agent Communication Poisoning | マルチエージェントレイヤ — Agent Communication Poisoning |
| T13 | Rogue Agents in Multi-Agent Systems | マルチエージェントレイヤ — Rogue Agents in Multi-Agent Systems |
| T14 | Human Attacks on Multi-Agent Systems | マルチエージェントレイヤ — Human Attacks on Multi-Agent Systems |
| T15 | Human Manipulation | 人間監督レイヤ — Human Manipulation |

---

## 入力/計画レイヤ — Intent Breaking & Goal Manipulation

RAG 検索結果に埋め込まれた指示が、複数ステップのラン（chat の tool loop、supervisor の
複数 specialist 呼び出し）の途中でエージェントの目的を書き換えようとする攻撃。
`externallyDriven` は一度立つとラン終了まで sticky で、supervisor の複数ステップに
またがっても有効（1 ステップだけの防御ではない）。

- 状態: Mitigated
- 実装: [`packages/agents/src/approval-policy.ts`](../packages/agents/src/approval-policy.ts)（`isExternallyDrivenTurn`）
- テスト: `packages/agents/tests/approval-policy.spec.ts`（`isExternallyDrivenTurn`）

## メモリ/RAG レイヤ — Memory Poisoning

本 repo は長期の会話メモリストアを持たない（ステートレス、リクエストごとに履歴を渡す。
Stage 0）ため、古典的な「エージェントの長期記憶に汚染データを埋め込む」攻撃面は狭い。
残る面は RAG コーパスの汚染で、provider/model/dim が異なる埋め込みの混入を拒否する
`assertNoProviderMixing` が該当する（LLM04/LLM08 と同じ実装）。

- 状態: Partial · accepted
- 実装: [`packages/rag/src/ingest/index.ts`](../packages/rag/src/ingest/index.ts)（`assertNoProviderMixing`）
- テスト: `packages/rag/tests/ingest.spec.ts`（`assertNoProviderMixing`）
- 再評価トリガ: 長期会話メモリストアを導入したとき（Stage 1 以降、リクエスト間で履歴を永続するようになったとき）

## ツール実行レイヤ — Tool Misuse

破壊的ツール（`sendEmail`）は HITL 承認ゲート（`needsApproval` → `'user-approval'`）と
宛先許可リスト（`RECIPIENT_ALLOWLIST`）という独立した 2 段の統制を持つ（Rule of Two）。
承認された呼び出しであっても許可リスト外の宛先には配送できない。

Supervisor が承認拒否を検知した際は、続く specialist を呼び出さずランを打ち切る
（拒否後に別の手段でツールを使い続けようとしない）。

- 状態: Mitigated
- 実装: [`packages/agents/src/approval-policy.ts`](../packages/agents/src/approval-policy.ts)（`isApprovalCapable`）、[`packages/tools/src/allowlist.ts`](../packages/tools/src/allowlist.ts)（`assertAllowedRecipient`）
- テスト: `packages/agents/tests/approval-policy.spec.ts`、`packages/tools/tests/allowlist.spec.ts`（`assertAllowedRecipient`）

## アイデンティティ/アクセスレイヤ — Privilege Compromise

エージェントの `runtimeContext`（`{ userId, role }`）は IdP の claim を直接信用せず、
サーバ側で認証済みメールを committed allow-list（`ADMIN_EMAILS`）に照合して解決する。
ツール実行がこの `role` を tool 引数経由で上書きする経路は存在しない。

- 状態: Mitigated
- 実装: [`apps/web/src/lib/auth.ts`](../apps/web/src/lib/auth.ts)（`toRuntimeContext`）、[`packages/config/src/role-allowlist.ts`](../packages/config/src/role-allowlist.ts)（`resolveVazRole`）
- テスト: `apps/web/tests/auth.spec.ts`（`toRuntimeContext`）、`packages/config/tests/role-allowlist.spec.ts`（`resolveVazRole`）

## アイデンティティ/アクセスレイヤ — Identity Spoofing & Impersonation

チャット・ジョブ API は Auth.js（OIDC）セッションからのみ `userId`/`role` を導出し、
ジョブ承認 API（`POST /api/jobs/:id/approve`）は `findJobOwnerUserId` でジョブ所有者と
呼び出し元セッションを突き合わせる（他ユーザーのジョブを承認/拒否できない）。

- 状態: Mitigated
- 実装: [`apps/web/src/lib/jobs.ts`](../apps/web/src/lib/jobs.ts)（`findJobOwnerUserId`）
- テスト: `apps/web/tests/jobs.spec.ts`（`findJobOwnerUserId`）

## オーケストレーション/リソースレイヤ — Resource Overload（Unbounded Consumption）

Chat は `stopWhen: [isStepCount(MAX_STEPS), buildBudgetStopCondition(budget)]` で
ステップ数・トークン予算の双方に上限を持つ（`docs/context-budget.md` Stage 0）。
Supervisor 側にも specialist 呼び出しの構造的な段数制限があり、無限ループへ
自律的に発散しない。

- 状態: Mitigated
- 実装: [`packages/agents/src/chat-agent.ts`](../packages/agents/src/chat-agent.ts)（`buildBudgetStopCondition`）
- テスト: `packages/agents/tests/chat-agent.spec.ts`

## オーケストレーション/データレイヤ — Cascading Hallucination

`rag-research` ステップの `citations` は自動的に後続の `document-generation` ステップへ
引き継がれる（citation handoff）。これにより、途中ステップで得た根拠が後続ステップで
再度モデルにより「捏造」されるのではなく、検証可能な形で機械的に伝播する。
生成ドキュメントの検証（`RunStopReason` の閉じた語彙）も、想定外の完了状態を
「成功」として扱わない設計になっている。

Tier2 eval（faithfulness/relevancy）が、最終回答が根拠（ツール出力・検索結果）に忠実かを
継続的に測定し、モデル/プロンプト変更による劣化を検知する（nightly / PR ゲート）。

- 状態: Mitigated
- 実装: [`packages/agents/src/supervisor.ts`](../packages/agents/src/supervisor.ts)（`WorkflowStepRunner`）、[`packages/evals/src/tier2.ts`](../packages/evals/src/tier2.ts)
- テスト: `packages/agents/tests/supervisor.spec.ts`（`WorkflowStepRunner`）、`packages/evals/tests/tier2.spec.ts`

## 人間監督レイヤ — Repudiation & Untraceability

すべてのツール実行（承認ゲート通過後・`execute` 直前）が単一の発火点で監査ログに
記録される（web/worker 両パスを 1 箇所のロジックが覆う）。「どのユーザーの、どのジョブの、
どのツール呼び出しか」を後から追跡できる。

- 状態: Mitigated
- 実装: [`packages/agents/src/audit-hook.ts`](../packages/agents/src/audit-hook.ts)（`createAuditHook`）
- テスト: `packages/agents/tests/audit-hook.spec.ts`（`createAuditHook`）

## 人間監督レイヤ — Overwhelming Human-in-the-Loop

承認要求は `needsApproval: true` を宣言したツール（現状 `sendEmail` のみ）に限定され、
読み取り専用ツール（`searchDocuments`/`getCurrentTime`）は承認を要求しない設計により、
承認疲れ（過剰な承認要求で人間監督が形骸化する攻撃面）を最小化している。ただし
「承認要求のレート制限」や「同一ユーザーへの短時間大量承認要求の検知」のような
能動的な対策は実装していない。

- 状態: Partial · accepted
- 実装: [`packages/agents/src/approval-policy.ts`](../packages/agents/src/approval-policy.ts)（`isApprovalCapable`）
- テスト: `packages/agents/tests/approval-policy.spec.ts`
- 再評価トリガ: `needsApproval: true` を持つツールが複数になったとき（同一ユーザーへの短時間大量発行が現実的なリスクになる規模に達したとき）

## 人間監督レイヤ — Misaligned & Deceptive Behaviors

エージェントが与えられた目的から逸脱した「偽装的に協調的な」振る舞いをする（目的を
達成したように見せかけて実際には別の行動を取る等）脅威に対する専用の検知機構はない。
Tier2 eval のスコア低下が間接的なシグナルにはなり得るが、この脅威を名指しして
検証するテストは存在しない。

- 状態: Accepted
- 実装: [`packages/evals/src/tier2.ts`](../packages/evals/src/tier2.ts)（間接的シグナルのみ。専用の検知機構ではない）
- テスト: `packages/evals/tests/tier2.spec.ts`
- 再評価トリガ: supervisor の専門家呼び出し経路に目的逸脱を検出できる構造的な仕組み（例: step 結果を独立した judge エージェントで検証する Doer-Verifier パターン）を導入したとき

## エージェント実行レイヤ — Unexpected RCE

エージェントが自律的にシステムコマンドや任意コードを実行できる経路が生まれることで、
意図しない Remote Code Execution が発生する脅威。本 repo の specialist（`rag-research` /
`document-generation` / `data-processing`）はファイルシステム操作・シェル呼び出しを
実行する仕組みを持たない。ツールは `@vaz/tools` に定義され、その `execute` 関数が
実行できる操作は事前に宣言されたシンボルのみに限定されている（コードを生成・実行する
汎用ツールは存在しない）。

`data-processing` の入力スキーマは `z.unknown()` であり任意の JSON を通すため、
悪意ある入力値が実際に危険な操作を行う `data-processing` specialist を将来実装した場合に
リスクが顕在化する可能性がある。現状の既定 specialist は `SpecialistUnavailableError` を
投げるため実害はない。

- 状態: Partial · accepted
- 実装: [`packages/tools/src/email.ts`](../packages/tools/src/email.ts)、[`packages/agents/src/supervisor.ts`](../packages/agents/src/supervisor.ts)（`SpecialistUnavailableError`）
- テスト: `packages/tools/tests/email.spec.ts`、`packages/agents/tests/supervisor.spec.ts`（`SpecialistUnavailableError`）
- 再評価トリガ: `data-processing` specialist を実装して任意の入力を受け取るようになったとき、またはファイルシステム・シェル操作を行うツールを追加したとき

## マルチエージェントレイヤ — Agent Communication Poisoning

supervisor から specialist へ渡すメッセージ（plan / citations / instructions）に
悪意ある内容を注入することでエージェントの出力を操作する脅威。

本ハブの supervisor は `packages/agents/src/supervisor.ts` で specialist を直接呼び出す
（エージェント間のネットワーク通信を経由しない）。渡されるのは Zod スキーマ
（`specialistInputSchema`）を通過した型付きオブジェクトのみ。`kind` は task 自身の値に
固定されており（`mergeApprovedArgs`）、編集でどの specialist が走るかは変えられない。
rag-research の `citations` は specialist 呼び出し前に即リセットされ、前のステップの
citations が後続の無関係なステップへ漏れることはない。

**非保証**: `data-processing.input: z.unknown()` は任意の JSON を通す。
現在の既定 specialist は `SpecialistUnavailableError` を投げるため実害はないが、
将来の `data-processing` 実装がこの入力を無批判に利用した場合に注入が成立し得る。

- 状態: Partial · accepted
- 実装: [`packages/agents/src/supervisor.ts`](../packages/agents/src/supervisor.ts)（`SpecialistUnavailableError`）、[`packages/schemas/src/workflows.ts`](../packages/schemas/src/workflows.ts)（`specialistInputSchema`）
- テスト: `packages/agents/tests/supervisor.spec.ts`（`SpecialistUnavailableError`）、`packages/schemas/tests/workflows.spec.ts`（`specialistInputSchema`）
- 再評価トリガ: `data-processing` specialist を実装して任意の入力スキーマを扱うようになったとき、またはエージェント間にネットワーク境界（MCP 等）を導入したとき

## マルチエージェントレイヤ — Rogue Agents in Multi-Agent Systems

多エージェント構成における「離反した specialist がシステム全体を乗っ取る」脅威。
supervisor が specialist の返り値を無批判に信用することで、偽装した specialist が
後続ステップや監査記録を汚染できる経路が生まれる。

specialist の返り値は `SpecialistResult` の Zod 型で受け取り、`WorkflowStepRunner` の
step 境界を経由して次のステップへ進む。`ApprovalDeniedError`（duck-typing で検知）を
受け取った場合はランを即座に打ち切り、後続 specialist を呼び出さない。`kind` は
task 自身の値に固定されており（`mergeApprovedArgs`）、specialist の返り値が後続の
specialist 種別を変えることはできない。

**非保証**: `data-processing` の返り値型は `z.unknown()` を内包するため、
偽装した `data-processing` specialist が返す値の内容を現在の構造チェックでは検証できない。

- 状態: Partial · accepted
- 実装: [`packages/agents/src/supervisor.ts`](../packages/agents/src/supervisor.ts)（`WorkflowStepRunner`）
- テスト: `packages/agents/tests/supervisor.spec.ts`（`WorkflowStepRunner`）
- 再評価トリガ: `data-processing` specialist を実装して返り値型が強くなったとき、またはエージェント間にネットワーク境界を導入したとき

## マルチエージェントレイヤ — Human Attacks on Multi-Agent Systems

多エージェント構成の「人間の監督者を騙す」脅威——エージェントが正当な HITL 承認
インターフェースを模倣した偽のプロンプトをユーザーに提示したり、承認 UI の見た目を
操作したりすることで、意図しない承認を引き出す。

承認要求はサーバ側の `step.waitForEvent`（Inngest engine）経由で発行され、
クライアント（`ApprovalPanel`）は SSE ストリームから `JobEvent` を受け取って表示する。
モデルが直接クライアント側に承認 UI を描画する経路はない。
`JobEvent` の `type` は `jobEventTypeEnum` で閉じており、モデルが任意の `type` を
生成することはできない。

**非保証**: フロントエンド側の XSS や React SSR の脆弱性を通じて承認 UI そのものを
改ざんする攻撃面は本対応表の射程外（Web セキュリティのレイヤ）。

- 状態: Partial · accepted
- 実装: [`packages/schemas/src/workflows.ts`](../packages/schemas/src/workflows.ts)（`jobEventTypeSchema`）、[`apps/web/src/features/jobs/ApprovalPanel.tsx`](../apps/web/src/features/jobs/ApprovalPanel.tsx)（`ApprovalPanel`）
- テスト: `apps/web/tests/ApprovalPanel.spec.tsx`（`ApprovalPanel`）、`packages/schemas/tests/workflows.spec.ts`（`specialistInputSchema`）
- 再評価トリガ: モデルが承認 UI のコンテンツを自由に記述できる経路（例: ストリーム内に任意 HTML を埋め込む仕組み）を導入したとき

## 人間監督レイヤ — Human Manipulation

エージェントがユーザーを社会工学的に操作することで、意図しない行動や情報開示を
引き出す脅威（例: フィッシング的な言語を使って承認ボタンを押させる）。

出所タクソノミの 15 脅威中、本脅威は最もエージェントの「表現の自由度」に依存する。
本 repo のモデルは `AI_PROVIDER` / `AI_MODEL` 環境変数で切り替え可能であり、
モデルそのものの操作傾向を本 repo の実装で制御する手段は現状ない。
`CHAT_SYSTEM_PROMPT` に操作的な言語を使わない旨を指示することはできるが、
モデルが従わない可能性を排除できない。

- 状態: Accepted
- 実装: [`packages/agents/src/prompt.ts`](../packages/agents/src/prompt.ts)（`CHAT_SYSTEM_PROMPT`。操作的指示を含まない設計だが、モデル側の忠実性は保証しない）
- テスト: `packages/agents/tests/prompt.spec.ts`（`CHAT_SYSTEM_PROMPT`）
- 再評価トリガ: モデル出力フィルタ（出力から操作的言語を除去するポストプロセッサ）を導入したとき、または承認フローの UI に警告・確認ステップ（"Are you sure?" 形式）を追加したとき
