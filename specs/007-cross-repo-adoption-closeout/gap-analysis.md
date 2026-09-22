# 007-cross-repo-adoption-closeout — 実装ギャップ分析

入力: [`spec.md`](spec.md)（Requirement 1〜12） / 正本レビュー `docs/cross-repo-adoption-review.md` §7 /
[`docs/cross-repo-adoption-backlog.md`](../../docs/cross-repo-adoption-backlog.md) §5。
調査日: 2026-09-22。

> 正本レビューを**リンクではなくコードスパン**で書いているのは意図的である。§3.6 の
> ガード衝突（`specs/` 2 階層下からの相対リンクが `cross-repo-reference-resolution.spec.ts` を
> 落とす）を回避するため、`specs/review/2026-09-22-cross-repo-verification.md` と同じ作法に揃えた。

> **steering の欠落**: `.sdd/steering/`（`structure.md` / `tech.md` / `product.md`）が
> **存在しない**。本分析はプロジェクトメモリの代替として `CLAUDE.md` / `AGENTS.md` /
> [`specs/memory/constitution.md`](../memory/constitution.md) を steering 相当として読んだ。
> 技術スタック・規約はこの 3 文書で十分に記述されているため分析品質への影響は小さいが、
> 「製品としての優先順位」に相当する情報源は無い。

---

## 1. 分析サマリ

- **本 spec は性質の異なる 2 つの塊**である。文書側（R1〜R4・R11）は**既存の強い雛形があり
  低リスク**、承認経路側（R5〜R10）は**新しい永続状態を 1 つ導入するかどうかが全体を決める**。
- **最大の構造的障害**: pending set（いま suspend していて決定を受け付けられる承認対象の集合）は
  現在 **durable engine（Inngest）の内部にしか存在せず、`apps/web` から読めない**。
  R6（consume-once ＋ 存在秘匿）・R7.2（429）・R9.2（決定セットの原子的拒否）はいずれも
  「送信前に pending set を参照する」ことを要求するため、**pending set を Postgres へミラーする
  新しい状態が R6・R7・R9 の共通の前提**になる。ADR-2（Inngest import は `inngest.ts` のみ）を
  守る限り、このミラーは worker 側から書くしかない。
- **D1（R5）は大半が既に成立している**——`approvalRequestSchema` に履歴/usage/model フィールドは
  無く（5.1 ✅）、`mergeApprovedArgs` の再バリデーションが `args` 内の偽造フィールドを既に
  剥がしている（5.3 の一部 ✅）。残るギャップは実質 **`z.object` → `z.strictObject` の 1 行**
  （5.2）とテストである。「実装ギャップ」ではなく「証明ギャップ」に近い。
- **R4（引用ガード）は雛形が揃っている一方、引用の書式が不統一**でパース設計が要る。
  シンボル引用は `の isExternallyDrivenTurn` / `(`ApprovalDeniedError` の構造的 duck-typing)` /
  `(`isApprovalCapable` — …)` と 3 形が混在し、CI 引用も「ステップ名」と「シェルコマンド」が
  混在する。**構造化引用ブロックを導入するか、散文をパースするか**が plan の分岐点（§6-A）。
- **推奨アプローチは Hybrid**（§4）: 文書 4 項目は既存文書の拡張、R6/R7/R9 は
  `job_approval` 新規テーブル 1 枚に共通の状態を集約、R5/R8/R10 は既存シームへの合流。
  文書側を先に単独で着地させられる（R11 の §8 addendum のみ最後に回す）。

---

## 2. 要件別ギャップ表

凡例: ✅ 既存コードで充足 / 🔧 部分的に存在（拡張が必要） / 🆕 新規

### 2.1 文書側（X-17〜X-20、R11）

| AC | 判定 | 根拠・所見 |
|---|---|---|
| 1.1 15 脅威全件の節 | 🆕 | 現状 **10 節**（`grep -c '^## '` = 10）で T1〜T10 のみ。[`docs/owasp-agentic-ai-top10-mapping.md:22-134`](../../docs/owasp-agentic-ai-top10-mapping.md) |
| 1.2 T11〜T15 の該当性＋状態トークン | 🆕 | 5 節を新設。現状 T11〜T15 の語はファイル内に 1 度も現れない |
| 1.3 supervisor の保証／非保証 | 🔧 | **引用すべき実装は全て存在する**: citation handoff とその即時リセット（[`supervisor.ts:452-463`](../../packages/agents/src/supervisor.ts)）／`ApprovalDeniedError` の構造的 duck-typing による打ち切り（`supervisor.ts:498-514`）／`WorkflowStepRunner` の step 境界（`supervisor.ts:87-89, 469`）。**追加の好材料**: `mergeApprovedArgs` が `kind` を task 自身の値に固定し「編集でどの specialist が走るかは変えられない」を保証（`supervisor.ts:420-426`）——Rogue Agents の直接の反例。非保証側: `data-processing.input: z.unknown()`（[`workflows.ts:66`](../../packages/schemas/src/workflows.ts)）が不透明な通し穴 |
| 1.4 実装が無い脅威も節を省略しない | 🆕 | 現状は「未対応」節が 1 つだけ（`agentic:127`）で、落ちている 5 件は節ごと不在 |
| 1.5 実装引用＋テスト引用の双方 | ✅→🔧 | **現存 22 クレームの引用は全件解決する**（下記検証済み）。新設 5 節にも同じ厳格さを課すのが 1.5 の意図 |
| 1.6 脅威 ID → 節の一覧 | 🆕 | そのような対応表は両文書に無い。R4.1〜4.5 の機械検査の足場にもなる |
| 2.1〜2.2 3 値の状態トークン | 🆕 | 現状の状態マーカーは「未対応」のみ（`agentic:125,127,134` / `llm:88,114`）。`Mitigated` 等の語は両文書に不在 |
| 2.3〜2.4 再評価トリガ | 🆕 | 概念そのものが無い |
| 2.5 冒頭の語彙定義 | 🔧 | 冒頭に方針文はある（`agentic:6-8` / `llm:4-8`）が、**その文自体が旧 2 値を規定している**ため 2.2 の対象。書き換え必須 |
| 2.6 「未対応」4 クレームの再分類 | ✅（対象の実在を確認） | 4 件すべて実在: LLM05 回帰ガード不在（`llm:88-89`）／LLM07（`llm:114`）／Overwhelming HITL レート制限（`agentic:125`）／Misaligned & Deceptive（`agentic:127,134`） |
| 3.1 内容に合わせたファイル名 | 🆕 | リネームが必要 |
| 3.2 本文が ASI を名乗らない | **✅ 既に充足** | `grep "ASI"` は**ヒット 0**。H1 も既に「脅威分類 対応表(レイヤ別)」。**不一致はファイル名のみ**で本文は元から内容側に揃っている——R3 の実作業はリネームと参照更新に限定される |
| 3.3 タクソノミ版日付 | 🆕 | 両文書とも版日付なし（`agentic:3` / `llm:3` はリンクのみ） |
| 3.4 参照更新 | 🔧 | **下記 §3.1 に全 6 箇所を列挙**。`AGENTS.md` には参照が**無い**ため、spec 3.4 の列挙は 1 件過大 |
| 3.5 相互参照の双方向維持 | 🔧 | 現状 `llm:12` → agentic（リンク）、`agentic:10` → llm（リンク）で双方向が成立済み。リネームで前者のみ壊れる |
| 4.1 ファイルパス引用の実在 | 🆕（ガード） | 雛形は [`doc-links.spec.ts`](../../tests/repo/doc-links.spec.ts)。ただし**テスト引用はコードスパン**（`- テスト: \`packages/...\``）のため既存ガードの射程外——本ガードが初めて見る対象 |
| 4.2 シンボル引用の実在 | 🆕（ガード） | **書式が 3 形に分岐**（§6-A）。要パース設計 |
| 4.3 CI ステップ名の実在 | 🆕（ガード） | `lint.yml` の `Model-ID gate` は実在（確認済み）。一方 `llm:54` の `pnpm audit --audit-level=moderate` は**ステップ名ではなくコマンド**——同一形式で扱えない |
| 4.4 語彙の 3 値検査 | 🆕（ガード） | R2 の成果物に依存。R2 と同時着地が必要 |
| 4.5 版日付の存在検査 | 🆕（ガード） | R3.3 に依存 |
| 4.6 非空アサート | ✅（パターン） | `doc-links.spec.ts:111-114, 141` がそのままの雛形 |
| 4.7 文書消失で失敗 | ✅（パターン） | `doc-links.spec.ts:116-120`（VENDORED_ROOTS 実在検査）が同型 |
| 4.8 `repo` プロジェクト／新規 workflow 無し | ✅ | `tests/repo/` に置くだけ。`vitest.config.ts` の `repo` プロジェクトが自動収集 |
| 11.1 §1〜§7 不改変 | ✅ | 追記のみで足りる |
| 11.2〜11.3 §8 addendum | 🆕 | review は 749 行で §7 が末尾。純粋な追記 |
| 11.4 追記のみ文書内リンクの是正 | 🔧 | **実際に衝突する**: `review.md:727` と `specs/review/2026-09-22-cross-repo-verification.md:94` が旧名への**相対リンク**。§3.1 参照 |
| 11.5 backlog §5 への反映 | 🔧 | `backlog.md:136-158` が「新規に起票すべき項目」として X-17〜X-20 を保持 |
| 11.6 リンク／コードスパン規約 | ✅（規約既存） | `backlog.md:112-115` が規約の正本。両ガードは現在緑 |
| 11.7 適用面の明記 | 🆕 | addendum の記述事項 |

**検証済み（R4 ガードが初日から緑になることの確認）**: 両文書が引用する 14 個のテストファイルを
実在確認し、**全件 OK**。`.github/workflows/lint.yml` の `Model-ID gate` ステップ名も実在。
引用行数の実測は agentic が実装 11 ＋ テスト 12、llm が実装 14 ＋ テスト 15。
正本 §7.6 の「全 40 引用」は 1 行に 2 引用を含む行を畳んだ値なので、
**ガードは件数を 40 とハードコードしない**こと（非空アサートは「> 0」で足りる）。

### 2.2 承認経路側（D1〜D6）

| AC | 判定 | 根拠・所見 |
|---|---|---|
| 5.1 履歴/usage/model フィールド不定義 | **✅ 既に充足** | [`approve/route.ts:33-37`](../../apps/web/src/app/api/jobs/%5Bid%5D/approve/route.ts) は `{ toolCallId, decision, args? }` のみ |
| 5.2 未定義フィールドで 400 | 🔧 | **Zod v4 の `z.object()` は未知キーを黙って strip する**（reject しない）。`z.strictObject()` へ 1 行変更で充足。現行の 400 経路自体は既にある（`route.ts:53`） |
| 5.3 偽造値がモデル／シグナル／監査に現れない | 🔧 | 5.2 で入口が閉じる。加えて **`args` 内に潜らせた偽造フィールドは既に剥がれている**: `mergeApprovedArgs` が `specialistInputSchema.parse` を通す（`supervisor.ts:420-426`）ため未知キーは strip される。**例外**: `data-processing.input: z.unknown()` は通る（§3.4） |
| 5.4 再開後のメッセージ列はサーバ側状態のみ | **✅ 既に充足** | `runJob` は `event.data.plan` を `supervisorPlanSchema.parse` し直す（[`main.ts:335`](../../apps/worker/src/main.ts)）。doc-gen specialist は `system` ＋ `prompt` のみで `messages` を渡さない（`supervisor.ts:342-349`）——保持する会話が構造的に存在しない。**テストで固定するのが本 AC の実務** |
| 5.5 拒否時に承認対象を消費しない | 🔧 | 現状は何も消費しないので自明に成立。R6 導入時に**検証→消費の順序**を壊さないことが要件化される |
| 6.1 consume-once | 🆕 | 現状 2 度目も 202。`submitApproval` は `engine.send` に **`id` を渡していない**（`main.ts:538`）——`submitJob` は `id: request.jobId` を渡す（`main.ts:525`）。**この非対称が第 1 の改善点**（engine 側 idempotency） |
| 6.2 3 ケースを単一 404 に | 🆕 | 現状は 3 ケースすべて 202。**情報漏洩は今は無いが防御も無い**。404 を導入するには pending set 参照が必要（§3.2） |
| 6.3 404 本文に識別子・状態語を載せない | 🆕 | 既存の拒否応答は `{ error: "..." }` 形式。同形で内容を無情報にすればよい |
| 6.4 ヘッダ／コードでも区別不能 | 🆕 | 単一の `Response.json` を共有すれば構造的に保証できる |
| 6.5 `authorizeJobAccess` 不変 | ✅ | [`jobs.ts:62-84`](../../apps/web/src/lib/jobs.ts) は独立関数。触らなければ済む |
| 6.6 再起動を跨ぐ consume-once | 🆕 | **新しい永続状態が必要**。`job` テーブルに該当列なし（[`schema.ts:148-154`](../../packages/db/src/schema.ts)） |
| 7.1 境界を跨ぐ累積 usage | 🔧 | usage は存在するが**終端でのみ集計**（`supervisor.ts:532-545`）。承認時点で web から読めない |
| 7.2 予算超過で 429 | 🆕 | 同上（永続状態依存） |
| 7.3 429 時も対象を消費 | 🆕 | R6 の消費機構に相乗り |
| 7.4 env 設定可＋既定値 | 🔧 | **パターン完備**: `CHAT_TOKEN_BUDGET: z.coerce.number().int().positive().default(200_000)`（[`env.ts:25`](../../packages/schemas/src/env.ts)）。同型の追加で済む |
| 7.5 `JobEvent` 追加は optional | **✅ 合流先が既にある** | `completion.metrics` が既に optional（[`workflows.ts:196`](../../packages/schemas/src/workflows.ts)）。**新フィールドを足さず既存 `metrics` に合流できる**（principle 5） |
| 7.6 サーバ観測値から算出 | 🔧 | `specialistResult.usage` は `generateText` の戻り（`supervisor.ts:356-360`）でサーバ観測値。**ただし報告するのは `document-generation` のみ**——`rag-research` はモデルを呼ばない。予算が実質 doc-gen のみを数える点はクレームの真実性として明記が必要 |
| 8.1 キー名のみ監査 | 🆕 | 承認経路に監査発火点が**現状ゼロ** |
| 8.2 単一境界 | 🔧 | 既存の単一発火点は [`audit-hook.ts`](../../packages/agents/src/audit-hook.ts)（ツール実行）。承認決定は別事象なので literal な合流は不可。**先例あり**: `supervisor.ts:315-331` が programmatic rag-research 用に 2 番目の明示 `record` を理由付きで追加済み |
| 8.3 監査失敗で再開を失敗させない | 🔧 | **雛形が完全に存在**: `audit-hook.ts:71-77` の try/catch ＋ `logger.error`（相関フィールドのみ）。同型をルート側に置く |
| 8.4 R4.7 安全なログ | ✅（規約） | 上記 catch が既に `args` を出さない形 |
| 8.5 既存監査の fail-loud 不変 | ✅ | `apps/worker/src/audit.ts` の `createAuditSink` が fail-loud、web もそれに委譲（[`audit.ts:43`](../../apps/web/src/lib/audit.ts)）。ルート側で catch するだけならシンクの方針は不変 |
| 8.6 callerId / jobId / 承認対象の追跡 | 🔧 | **`callerId` は既に手元にある**が現ルートは `authz.callerId` を**捨てている**（`route.ts:41-42`）。`AuditEntry` に承認対象用フィールドは無いので `args` jsonb に載せる形になる（§6-C） |
| 9.1 決定セット受理 | 🆕 | 現状は単一決定のみ |
| 9.2 1 件でも不正なら 409 で全体拒否 | 🆕 | pending set 参照＋送信前検証が前提 |
| 9.3 重複は 409 | 🆕 | セット内重複検査 |
| 9.4 既存単一ボディを維持 | 🔧 | [`ApprovalPanel.tsx:135-139`](../../apps/web/src/features/jobs/ApprovalPanel.tsx) が単一形を送る。Zod union（単一 \| セット）で両立。**既存 11 テスト**（`apps/web/tests/jobs-approve-route.spec.ts`）が単一形を固定しており回帰検知として機能する |
| 9.5 409 本文で列挙しない | 🆕 | 6.3 と同じ無情報応答 |
| 9.6 拒否時は消費せず監査もしない | 🔧 | ツール実行の記録は再開後の worker 側で起きるため後段は自明。前段（消費しない）は R6 の順序要件と同一 |
| 10.1 egress 迂回の走査 | 🆕（ガード） | **初日から緑になることを確認済み**: `apps/*/src` ＋ `packages/*/src` にメールアドレス形リテラルは**0 件**。許可リスト判定は `email.ts:111` の `assertAllowedRecipient(input.to, allowlist)` の 1 箇所のみ |
| 10.2 非空アサート | ✅（パターン） | `doc-links.spec.ts` と同型 |
| 10.3 例外列挙＋実在検査 | ✅（パターン） | `doc-links.spec.ts:48, 116-120`（VENDORED_ROOTS ＋ 実在検査）が同型。テストフィクスチャは `tests/` 配下で 10.1 の走査範囲外なので偽陽性化しにくい |
| 10.4 出所と CVE をドックコメントに | 🆕 | CVE 番号は正本 §7.3 が `CVE-2026-46678` を引用（`review.md:663-664`）。兄弟 repo パスはコードスパンで書く規約（`backlog.md:112-115`） |
| 10.5 `repo` プロジェクト | ✅ | R4.8 と同じ |
| 12.1 `mise run check` 緑 | 🔧 | `mise.toml:81` の `check` |
| 12.2 新規 workflow を追加しない | ⚠️ | **spec の「既存 6 本」は古い**。実測 **7 本**（`api.yml` が spec `006` で追加）。要件の意図は不変だが数値は訂正が必要 |
| 12.3 `lint:model-ids` 緑 | ✅ | 新コードにモデル文字列を書かなければ自明 |
| 12.4 非空虚性 | 🔧 | 憲章 principle 3（`constitution.md:55-58`）の要求 |
| 12.5 ネットワーク非依存テスト | ✅（パターン） | 既存 `jobs-approve-route.spec.ts` が engine / `submitApproval` / `authorizeJobAccess` を全モックし、Inngest SDK もネットワークも使わない |
| 12.6 カバレッジ ≥ 80% | 🔧 | App Router 配下は coverage 除外だが `lib/` は対象。新規状態を `lib/` に置く場合はテストが必要 |
| 12.7 トレーサビリティ記録 | 🆕 | `specs/007-.../` 配下に新設 |

---

## 3. 統合上の課題

### 3.1 リネームで壊れる参照（R3.4 / R11.4）— 全 6 箇所を実測

`grep -rn "owasp-agentic-ai-top10-mapping"` の結果を、`doc-links.spec.ts` が
**相対リンクのみ**を検査し**コードスパンは `stripCode` で除外する**（`doc-links.spec.ts:58-60`）
性質に照らして分類した。

| 箇所 | 形式 | ガードが落とすか | 扱い |
|---|---|---|---|
| `CLAUDE.md:7` | リンク | **落ちる** | 通常更新 |
| `docs/owasp-llm-top10-mapping.md:12` | リンク | **落ちる** | 通常更新（R3.5 の相互参照） |
| `docs/cross-repo-adoption-backlog.md:139` | リンク | **落ちる** | 通常更新（R11.5 と同時） |
| `docs/cross-repo-adoption-backlog.md:152` | コードスパン | 落ちない | 内容の整合上は更新が望ましい |
| `docs/cross-repo-adoption-review.md:727` | リンク | **落ちる** | ⚠️ **追記のみ文書** → R11.4 該当 |
| `specs/review/2026-09-22-cross-repo-verification.md:94` | リンク | **落ちる** | ⚠️ **時点の記録** → R11.4 該当 |

- **`AGENTS.md` に参照は無い**（spec 3.4 の列挙は 1 件過大）。
- R11.4 該当の 2 件は「主張を変えずリンク先のみ是正」で処理する。`review.md` 側は §8 addendum に
  是正の事実を記録する運用が spec に定められている。`specs/review/` 側は spec 11.4 の文面が
  「追記のみ規約の文書内」と限定しているため、**同ファイルを同じ扱いにするかは plan の判断**（§6-D）。
- 本 spec の `spec.md` 自身にも 3 箇所（14 / 48 / 65 行）旧名がある。こちらは spec 本文なので
  リネーム後に不整合になるが、`doc-links.spec.ts` はコードスパン・リンクの別で判定する。

### 3.2 pending set はエンジンの中にあり、web から読めない（最重要）

R6.2 / R7.2 / R9.2 はいずれも「**engine へ送る前に**、その承認対象がいま決定を受け付けられるかを
判定する」ことを要求する。ところが現在の真実の所在は次のとおり:

```
POST /api/jobs/:id/approve          suspend している実体
  authorizeJobAccess (job 表を読む)       Inngest step.waitForEvent
  → submitApproval → engine.send   ←─────  `await-approval:<stepId>` で
    （無条件に 202）                        engine がサーバ側に memo 化
```

- `toApprovalGate`（[`inngest.ts:56-67`](../../apps/worker/src/inngest.ts)）が待ち受けを作るが、
  **その待ち受けの存在を問い合わせる API は engine 固有**であり、ADR-2 により
  `apps/worker/src/inngest.ts` の外では import できない（AGENTS.md の不変条件）。
- したがって pending set は **worker が suspend する瞬間に Postgres へ書き出す**必要がある。
  書き手は `createDurableStepRunner`（`main.ts:243-255`）または `runJob` の周辺——
  いずれも `apps/worker/src/main.ts`。spec の out-of-scope は `requiresApprovalForKind` のみを
  除外しているので **`main.ts` への変更自体は境界内**だが、次の 2 点に注意:
  - `runJob` は Inngest のリトライ／再開ごとに**関数本体全体が再実行される**（`main.ts:434-437` の
    コメントと `jobStore.insert` の `onConflictDoNothing` がその証拠）。pending set の書き込みも
    **冪等でなければならない**——さもなくば「再開のたびに承認対象が pending へ戻り、
    consume-once が破れる」。これが R6 実装で最も踏みやすい罠。
  - `approvalGate` は意図的に `engineStep.run` で包まれていない（`main.ts:209-231` の長い理由書き）。
    pending set の書き込みをここへ足すとき、**step のネストを作らない**こと。
- 代替として「engine へ無条件に送り、consume-once は worker 側の gate で判定する」設計もあり得るが、
  R6.2 が **API の応答として 404** を要求しているため、fire-and-forget の現構造（202 即返し）とは
  両立しない。**R6 は承認 API を fire-and-forget から「検証してから送る」へ変える**——
  これは `route.ts:6-31` のドックコメントが明言する現行の設計方針の転換であり、
  plan で明示的に記録すべき決定。

### 3.3 新しい永続状態の置き場所（R6.6 / R7.1）

`job` 表は `{ id, userId, status, workflow, createdAt }` のみ（`schema.ts:148-154`）。
候補と評価:

| 案 | 内容 | 評価 |
|---|---|---|
| **A. `job_approval` 新規テーブル** | `(jobId, stepId)` を PK に `state` / `consumedAt` / `cumulativeTokens` | 最も素直。migration 1 枚（`packages/db/drizzle/0002_*.sql`、`db:migrate` は lexical order で冪等）。`schema-ddl.spec.ts` のドリフトテストが自動で守る |
| B. `job_event` へ相乗り | 新しい `type` を足す | ✗ `jobEventTypeEnum` は pg enum で `jobEventTypeSchema` と**ロックステップ**（`schema.ts:131-144`）。値追加は SSE の公開契約変更を伴い、R7.5 の後方互換方針にも逆行 |
| C. `job` へ列追加 | `cumulativeTokens` 等 | 累積 usage 単体なら可。ただし consume-once は承認対象ごとなので `job` 単位に収まらない。A と併用になり二重管理 |
| D. Redis | 既存の pub/sub を流用 | ✗ R6.6「プロセス内メモリのみに置かない」は満たすが、Redis は本 repo では**イベント fan-out 専用**で永続ストアではない。再起動耐性の保証を Redis に負わせる新方針になる |

**A が有力**。`packages/db` は schema-only（pool は composition root）なので依存方向も破れない。
累積 usage も同テーブルに集約すれば R7.2 の「追加 DB ラウンドトリップ 2 回以内」（NFR 性能）を
**1 回**で満たせる。

### 3.4 `args` の残る通し穴（R5.3）

`mergeApprovedArgs` の `specialistInputSchema.parse` が未知キーを剥がすため、
`args: { message_history: [...] }` のような偽造は既に無効化されている。ただし
`data-processing` の `input: z.unknown()`（`workflows.ts:66`）は**任意の JSON をそのまま通す**。
現在 `data-processing` の既定 specialist は `SpecialistUnavailableError` を投げる
（`supervisor.ts:364-366`）ので実害は無いが、R5.3 の「モデル入力に現れない」を
**無条件の主張として書けるのは今だけ**である。R2 の状態トークンで言えば
`Partial · accepted` ＋ 再評価トリガ「`data-processing` specialist を実装したとき」が正確。

### 3.5 その他

- **`submitApproval` に idempotency key が無い**（`main.ts:538` vs `submitJob` の `main.ts:525`）。
  R6.1 / R9.2 の実装で `id: \`${jobId}:${stepId}\`` を足すのは低コストで効果が大きい。
  ただし engine 側 idempotency は**多重送信を畳むだけ**で、R6.2 の 404 応答は作れない（§3.2）。
- **R9 の真の原子性は engine 越えでは達成できない**。決定セットを 1 DB トランザクションで
  「検証＋消費」してから N 回 `engine.send` する構成では、送信途中のクラッシュで部分再開が残る。
  **DB 側を single source of truth にし、送信は at-least-once ＋ idempotency key で冪等化する**のが
  現実的な到達点。R9.2 の文言（「いずれのステップも再開せず」）はこの設計で満たせるが、
  「送信後のクラッシュ」は別のリスクとして plan に残す。
- **`instrumentEmit` の span Map はプロセス内**（`main.ts:352`）。suspend/resume を跨ぐと
  step span が閉じられない既存の性質があり、R7 の usage 観測をここに乗せると同じ問題を継ぐ。
  usage は `specialistResult.usage` 経由で読むのが安全。
- **カバレッジ除外の境界**: `apps/web/src/app/**` は除外、`apps/web/src/lib/**` は対象（AGENTS.md）。
  R5〜R9 のロジックを `route.ts` に集めると 12.6 は楽だが 12.4（非空虚性）が弱くなる。
  `lib/` 側に純関数として切り出すのが既存の `lib/jobs.ts` の作法と整合する。

### 3.6 実測: `cross-repo-reference-resolution.spec.ts` は**いま赤**（R11.6 の先行ブロッカー）

本分析の最中に発見した実在の不具合。`pnpm exec vitest run --project repo` を走らせた結果:

```
FAIL tests/repo/cross-repo-reference-resolution.spec.ts
  every repo-qualified reference names the current hub, not a stale name
  + "specs/007-cross-repo-adoption-closeout/spec.md: \"<..>/docs/<canonical-review>\""
```

- **原因**: 同ガードの `QUALIFIED_FORM = /([A-Za-z0-9_.-]+)\/docs\/cross-repo-adoption-review\.md/g`
  （[`cross-repo-reference-resolution.spec.ts:68`](../../tests/repo/cross-repo-reference-resolution.spec.ts)）は
  文字クラスに `.` を含むため、2 階層上を指す相対リンク（`..` ＋ `/docs/` ＋ 正本ファイル名）の
  **`..` をリポジトリ名として捕捉する**。`..` ≠ `vaz-agentic-ai-next` なので stale 判定になる。
- **第 2 の偽陽性クラス**: 同ガードは `doc-links.spec.ts` と違い **`stripCode` を持たず生テキストを
  走査する**（`findReferencingFiles` は `text.includes` ＋ 生 `matchAll`）。そのため
  コードスパンや fenced block の中で**パスを話題にしただけ**でも stale 判定になる——
  本 gap-analysis 自身がこの節を書く過程で 2 度踏んだ（上のログ引用とこの regex の説明）。
  ガードを修正する場合はこの点も併せて判断対象になる。
- **なぜ今まで緑だったか**: 既存の参照は (a) リポジトリルートからの `docs/...`（`CLAUDE.md:9`）、
  (b) `docs/` 内・`docs/adr/` 等からの `../cross-repo-adoption-review.md`（`/docs/` 区間を含まない）、
  (c) コードスパン（`specs/review/2026-09-22-cross-repo-verification.md`）のいずれかだった。
  **`specs/<feature>/` のような 2 階層下からリンクした committed ファイルは 1 つも無かった**。
  本 spec の `spec.md:5` がその最初の例になり、ガードを赤にした。
- **含意**: 「本 repo 内の文書はリンク」という規約（`backlog.md:112-115`）には
  **未文書化の例外**がある——正本レビューを 2 階層下から参照する場合はコードスパンにするしかない。
  R11.6 は「両ガードが緑」を完了条件にしているので、**これは着手前から存在する未処理事項**である。
- **選択肢**: (i) `spec.md:5` をコードスパンに直す（既存作法に合流、principle 5）／
  (ii) ガードの regex を `(?!\.\.)` 等で相対パスを除外するよう修正する（規約を文字どおり保てるが
  ガードの意図＝「repo 修飾形のみを見る」に相対パス除外を足す変更）。**§6-J** で決める。

---

## 4. 実装アプローチの選択肢

### 4.1 全体戦略

| 案 | 内容 | コスト | リスク |
|---|---|---|---|
| **① Hybrid（推奨）** | 文書 4 項目＝既存文書の拡張／R6・R7・R9 ＝ `job_approval` 1 枚に共通状態を集約／R5・R8・R10 ＝ 既存シームへ合流 | 中 | 中（migration ＋ `main.ts` への書き込み点追加） |
| ② 全面 Extend | 新規テーブルを作らず `job` 列追加＋engine idempotency のみで済ませる | 低 | **高**。R6.2 の 404・R9.2 の原子的拒否が原理的に作れず、AC を満たせない |
| ③ 承認サービスを新設 | 承認状態を扱う独立モジュール（`packages/approvals` 等）を作る | 高 | 中。依存グラフに 8 個目のパッケージが増え、principle 5（既存経路へ合流）に逆行 |

**①を推奨**する理由: R7.5 は `completion.metrics` という**既存の optional フィールドに合流できる**、
R8.3 は `audit-hook.ts` の try/catch を**そのまま写せる**、R10 は `doc-links.spec.ts` の
ツリー走査と例外実在検査を**そのまま写せる**——新機構が要るのは「pending set ＋ 累積 usage」の
1 点だけ、という構造が既存コードから読み取れる。

### 4.2 R4 ガードの引用パース（独立した分岐）

| 案 | 内容 | コスト | リスク |
|---|---|---|---|
| **a. 構造化引用ブロックを導入** | 各節末を `- 実装: …` / `- テスト: …` / `- 状態: Mitigated` / `- 再評価トリガ: …` の固定キー行に揃え、ガードは行頭キーでパース | 中（2 文書を書き換える。ただし R1・R2 で**どうせ全節に手が入る**） | 低。将来の節追加も同形に強制される |
| b. 散文を正規表現で拾う | 現行の 3 形のシンボル記法をすべて拾う正規表現を書く | 低 | **高**。書式が増えるたびに静かに見落とす——「走査 0 件で緑」の親戚 |
| c. 引用をファイルへ外出し | YAML/JSON の引用台帳を別置きし、文書と台帳の両方をガード | 高 | 二重管理。文書が正本でなくなる |

**a を推奨**。R1（5 節追加）と R2（全クレームに状態トークン付与）で全節を触るので、
書式統一の追加コストはほぼゼロ。4.2 / 4.3 / 4.4 / 4.5 が同じパーサで賄える。

### 4.3 R9 の後方互換（9.1 ＋ 9.4）

| 案 | 内容 | 評価 |
|---|---|---|
| **判別可能 union** | `z.union([strictSingle, strictSet])` で単一形とセット形を受理 | 推奨。既存 11 テストがそのまま回帰ガードになる |
| 単一形をセット形へ正規化 | ルート入口で `{decisions:[body]}` に畳む | 併用推奨。以降のロジックを 1 経路に保てる（principle 5） |
| セット形のみへ移行 | `ApprovalPanel.tsx` も同時変更 | ✗ 9.4 が明示的に禁止 |

---

## 5. 既存パターン・規約の棚卸し（そのまま流用できるもの）

| 必要な作法 | 既存の出所 |
|---|---|
| repo ガードの骨格（ツリー走査／非空アサート／例外リストの実在検査） | [`tests/repo/doc-links.spec.ts`](../../tests/repo/doc-links.spec.ts) |
| ネットワーク非依存の承認ルートテスト（engine・authz を `vi.hoisted` で全モック） | [`apps/web/tests/jobs-approve-route.spec.ts`](../../apps/web/tests/jobs-approve-route.spec.ts) |
| 監査の fail-soft ＋ R4.7 安全ログ | [`packages/agents/src/audit-hook.ts:71-77`](../../packages/agents/src/audit-hook.ts) |
| 予算 env（coerce ＋ positive ＋ default） | [`packages/schemas/src/env.ts:25`](../../packages/schemas/src/env.ts) |
| 冪等な DB 書き込み（Inngest 再実行対策） | [`apps/worker/src/stores.ts:114-127`](../../apps/worker/src/stores.ts) |
| migration の置き方（手書き SQL ＋ ドリフトテスト） | `packages/db/drizzle/0001_add_locator.sql` ＋ `packages/db/tests/schema-ddl.spec.ts` |
| web が `@vaz/worker` の port を再利用する作法 | [`apps/web/src/lib/jobs.ts`](../../apps/web/src/lib/jobs.ts) / [`apps/web/src/lib/audit.ts`](../../apps/web/src/lib/audit.ts) |
| 本 repo はリンク・兄弟 repo はコードスパン | `docs/cross-repo-adoption-backlog.md:112-115` |

---

## 6. plan フェーズで詰める必要がある論点

- **A. R4 の引用書式**（§4.2）。構造化引用ブロックを導入するか。導入するなら
  `- 状態:` / `- 再評価トリガ:` のキー名を先に決める（R2 の成果物形式そのもの）。
- **B. pending set の書き込み点**（§3.2）。`createDurableStepRunner` 内か `runJob` 側か。
  **Inngest の関数本体再実行に対する冪等性**をどう保証するか（consume 済みを pending へ戻さない）。
  `approvalGate` を `engineStep.run` で包まない既存の制約を壊さないこと。
- **C. 承認決定の監査先**（R8）。`audit_log` を再利用して `tool: "approval:edit-args"` ＋
  `args: { keys, stepId }` とするか、専用テーブルを立てるか。再利用は principle 5 と整合する一方
  `AuditEntry.tool` の意味を「ツール名」から広げる。承認対象の識別子を載せる場所も同時に決まる。
- **D. `specs/review/2026-09-22-cross-repo-verification.md` の扱い**（§3.1）。
  spec 11.4 は「追記のみ規約の文書内」と限定しているが、同ファイルも時点の記録である。
  リンク是正の対象に含めるか（含めないと `doc-links.spec.ts` が落ちるため、
  実質は「含めた上で addendum に記録するか否か」の判断）。
- **E. 承認 API の 202 fire-and-forget からの転換**（§3.2 末尾）。R6.2 の 404 は
  `route.ts` のドックコメントが明言する現行方針の変更を伴う。転換を design に明記し、
  `POST /api/jobs` 側（202 のまま）との非対称を意図として記録する。
- **F. R7 の予算が doc-gen のみを数える点**（§2.2 の 7.6）。クレームとして正確に書くため
  状態トークンは `Partial · accepted` になる可能性が高い。再評価トリガの文面も同時に決まる。
- **G. spec 側の要訂正 2 点**: 12.2 の「既存 6 本」は実測 **7 本**（`api.yml` 追加後）。
  3.4 の参照列挙に含まれる `AGENTS.md` には**参照が無い**。いずれも要件の意図は変わらないが、
  受け入れ判定の文言としては誤り。plan で訂正するか spec を改訂するかを決める。
- **H. R9 の「送信後クラッシュ」の残余リスク**（§3.5）。DB を single source of truth にし
  `engine.send` を idempotency key で冪等化した後に残るリスクを、受容として記録するか。
- **I. 新規ロジックの置き場所とカバレッジ**（§3.5 末尾）。`route.ts` へ集約すると 12.6 は通るが
  12.4 が弱まる。`lib/` への純関数切り出しを既定にするか。
- **J. `cross-repo-reference-resolution.spec.ts` の赤をどう閉じるか**（§3.6）。
  `spec.md:5` をコードスパンに直すか、ガードの regex から相対パスを除外するか。
  **R11.6 の完了条件に直結し、かつ本 spec の着手前から赤なので最初に処理する**のが望ましい。
