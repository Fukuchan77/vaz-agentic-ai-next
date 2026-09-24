# 007-cross-repo-adoption-closeout

## Project Description

正本レビュー `docs/cross-repo-adoption-review.md`
（5 repo 横断の取り込み検証、X-1〜X-16 ＋ §6・§7 追記）を入力とする。
同レビューは 2026-09-22 の §7 追記で全 5 repo を実クローン再検証し、その結果として
**本ハブ側に残る作業**を特定した。本 spec はその closeout を扱う。

入力文書が残した本ハブ側の残作業（`docs/cross-repo-adoption-backlog.md` §5 が起票）:

| ID | 優先度 | 内容 |
|---|---|---|
| X-17 | 高 | `docs/owasp-agentic-ai-top10-mapping.md` が出所タクソノミ 15 脅威のうち T11〜T15（Unexpected RCE / Agent Communication Poisoning / Rogue Agents in Multi-Agent Systems / Human Attacks on Multi-Agent Systems / Human Manipulation）を**受容と明記せずに落としている**。supervisor → specialist の多エージェント構成を持つ本ハブにこそ該当する |
| X-18 | 中 | 状態語彙が「対応済み / 未対応」の 2 値しかなく、部分対応＋残余リスク受容を表現できない。受容行ごとの再評価トリガも無い |
| X-19 | 中 | ファイル名が Agentic Top 10（ASI01–ASI10）を名乗るのに内容は旧「Threats and Mitigations」のレイヤ別脅威表。両文書にタクソノミのバージョン日付が無い |
| X-20 | 低 | 2 文書の全 40 引用は 2026-09-22 時点で解決するが、それを守る仕組みが無い（手動確認に依存） |

前提として確認済みの事実（§6.2 / §7、再実測済み）:

- X-1（Actions SHA 固定 28/28・`permissions:` 6/6）、X-2 / X-3 / X-5 / X-11 / X-13 / X-14 / X-15 / X-16 は**着地済み**。
- X-13 の前提は逆転しており、**テスト引用の厳格さでは本ハブが出所を上回る**（§7.6）。
  したがって「出所の形式を真似る」項目としては読まない。
- X-9 の `apps/worker` 側 `requiresApprovalForKind: () => false` は**意図的に未着手**
  （`workflowStepSchema` へのステップ単位承認フラグ追加という横断的変更を要する）。
- `beeai-agentic-ai-sandbox` は別プロダクトへ全面置換され、X-11 / X-14 / X-16 の
  **取り込み元として再利用できない**（本ハブ側は着地済みのため実害なし）。

## Clarifications

<!--
Populated by /sdd-init. Each session is recorded as:
### Session YYYY-MM-DD
- Q: <question> → A: <answer>
-->

### Session 2026-09-22

- Q: 本 spec のスコープ境界をどこに置くか（X-17〜X-20 のみ / ＋§7.3 の HITL 防御 6 点の差分評価 / ＋同 6 点の実装 / ＋X-9 worker 側クローズ） → A: **X-17〜X-20 ＋ §7.3 の 6 防御を実装**。文書 4 項目に加え、`pydantic-ai-sandbox/patterns/hitl/` が持ち本ハブが持たない 6 防御（履歴注入のスキーマレベル封鎖 / consume-once ＋ 存在秘匿 / 境界を跨ぐ usage 予算 / マスク済み監査の単一 fail-soft 境界 / pending set の原子性 / egress ポリシーの回帰スキャン）を実際に配線する。
- Q: §7.3 の 6 防御をどの面に実装するか（web の job/approval / ＋`/api/chat` / ＋`services/api` / 全 3 面） → A: **`apps/web` の job/approval 経路**（`POST /api/jobs/:id/approve` ＋ `GET /api/jobs/:id/stream`）。本ハブの resume 相当はこの経路であり、consume-once・存在秘匿・pending set の原子性・マスク済み監査の fail-soft 境界・usage 予算はそのまま写像できる。`services/api` は verbatim subtree（上流の所有物）なので触らない。`/api/chat` は `useChat` がクライアント側履歴を送る前提のため、「サーバ側履歴が正」の封鎖は別設計判断として out of scope。
- Q: X-19 のタクソノミ不一致をどちらに揃えるか（内容側にリネーム / ファイル名側に再構成 / 2 タクソノミ併記 / 冒頭注記のみ） → A: **内容側に揃えてリネーム**。レイヤ別 Threats and Mitigations タクソノミ（15 脅威）を正として維持し、ファイル名をそれに合わせてリネームする。X-17（T11〜T15 を節として追加）と整合し「15 脅威全件を収録」が自明になる。`CLAUDE.md` / `AGENTS.md` / `docs/cross-repo-adoption-backlog.md` / 正本 §7 の参照更新を伴う（`tests/repo/doc-links.spec.ts` が未更新リンクを落とす）。
- Q: X-18 の状態語彙をどう定めるか（出所の 3 値 verbatim / 日本語 3 値 / 4 値へ拡張） → A: **出所の 3 値（`Mitigated` / `Partial · accepted` / `Accepted`）を verbatim で採用**。兄弟 repo との比較可能性を維持し、将来の横断レビューで語彙変換が要らない。受容行（`Partial · accepted` / `Accepted`）には再評価トリガを「具体的な将来の変更」として必須にする。
- Q: X-20 のガードはどこまでを機械検証するか（引用＋語彙＋日付 / 引用のみ / ＋再評価トリガ必須 / ＋15 脅威全件） → A: **引用＋語彙＋バージョン日付**。1 本の `tests/repo/` spec で (a) 2 文書の全引用パス・シンボルの実在、(b) 状態語彙が 3 値のいずれかであること、(c) 両文書のタクソノミバージョン日付の存在を検査する。X-18 / X-19 のドリフトも同じガードが守る。既存ガード同様、「走査した引用数 > 0」の非空アサートを先に置く。

## Scope

- In scope:
  - **X-17** — `docs/owasp-agentic-ai-top10-mapping.md` に欠落 5 脅威（T11〜T15）を追加し、supervisor が specialist 間で何を保証し何を保証しないかを明記する。
  - **X-18** — 状態語彙を出所 verbatim の 3 値（`Mitigated` / `Partial · accepted` / `Accepted`）に置き換え、受容行ごとに再評価トリガを具体的な将来の変更として書く。
  - **X-19** — Agentic 側文書を内容（レイヤ別 Threats and Mitigations・15 脅威）に合わせてリネームし、両文書の冒頭にタクソノミのバージョン日付を明記する。リネームに追随する参照更新も本 spec の boundary に含む。
  - **X-20** — `tests/repo/` に 1 本のガードを追加し、(a) 2 文書の全引用の実在、(b) 状態語彙が 3 値のいずれか、(c) タクソノミバージョン日付の存在を検査する（「走査した引用数 > 0」の非空アサートを先に置く）。
  - **§7.3 の 6 防御** — `apps/web` の job/approval 経路（`POST /api/jobs/:id/approve` ＋ `GET /api/jobs/:id/stream`）に対して実装。
- Out of scope:
  - `services/api`（verbatim `git subtree` 取り込み。上流の所有物であり本 spec では変更しない）。
  - `/api/chat` の「サーバ側履歴が正」への転換（`useChat` の前提を変える別設計判断）。
  - X-9 の `apps/worker` 側 `requiresApprovalForKind` クローズ（`workflowStepSchema` へのステップ単位フラグ追加という横断的変更）。
  - 停止理由語彙（X-5）の強制統一。正本 §3 のとおり写像表までで別スコープ。
  - 正本 §1〜§7 の本文改変（追記のみ規約）。本 spec の着地は日付付き §8 addendum として追記する。

## Glossary

| Term | Definition |
|------|------------|
| 正本レビュー | `docs/cross-repo-adoption-review.md`。5 repo 横断の取り込みレビュー（X-1〜X-20）。追記のみ規約（§1〜§7 は改変しない） |
| 対応表 2 文書 | `docs/owasp-llm-top10-mapping.md` と Agentic 側対応表（本 spec でリネームされる `docs/owasp-agentic-ai-top10-mapping.md`）の 2 つ |
| クレーム | 対応表の 1 節が主張する「この脅威に対して本ハブはこうしている」という 1 単位。実装引用・テスト引用・状態トークンを伴う |
| 状態トークン | クレームの対応状況を表す 3 値のいずれか: `Mitigated` / `Partial · accepted` / `Accepted`（出所 verbatim） |
| 再評価トリガ | 受容（`Partial · accepted` / `Accepted`）を見直すべき**具体的な将来の変更**の記述。「定期的に見直す」のような時間基準は再評価トリガとして認めない |
| 引用 | 対応表が指す 3 種の参照: ファイルパス / シンボル名（関数・定数・型） / CI ステップ名 |
| タクソノミバージョン日付 | 対応表が突き合わせた出所タクソノミの版を示す ISO-8601 日付（機械可読な形式） |
| 承認 API | `POST /api/jobs/:id/approve`（`apps/web`）。本ハブにおける resume 相当の入口 |
| ジョブストリーム | `GET /api/jobs/:id/stream`（SSE、`JobEvent` を配信） |
| 承認対象 | 承認 API が決定を適用する単位。ワイヤ上は `toolCallId`、エンジン上は suspend 中ステップの `stepId` に対応する |
| pending set | あるジョブについて「現在 suspend しており決定を受け付けられる承認対象」の集合 |
| 6 防御 | 正本 §7.3 が列挙した、`pydantic-ai-sandbox` の `patterns/hitl/` が持ち本ハブが持たない防御 6 点（D1〜D6） |
| D1〜D6 | D1 履歴注入のスキーマレベル封鎖 / D2 consume-once ＋ 存在秘匿 / D3 境界を跨ぐ usage 予算 / D4 マスク済み監査の単一 fail-soft 境界 / D5 pending set の原子性 / D6 egress ポリシーの回帰スキャン |
| リポジトリガード | `tests/repo/` 配下の Vitest `repo` プロジェクトのテスト。パッケージに属さないリポジトリ統治の検査 |
| 非空アサート | 「走査対象が 0 件でないこと」を先に検査するアサーション。走査 0 件で緑になる偽陽性緑を塞ぐ |

## Requirements

<!--
EARS 形式（`~/.claude/sdd/rules/ears-format.md`）。見出しは先頭数値 ID のみ。
受け入れ基準は階層番号（1.1, 1.2）で、plan.md / tasks.md のトレーサビリティキーになる。
WHAT のみ。アーキテクチャ・実装手段は plan.md に置く。
-->

### Requirement 1: Agentic 脅威タクソノミを 15 脅威全件で収録する（X-17）

Agentic 側対応表は出所タクソノミ（OWASP GenAI Security Project *Agentic AI – Threats and
Mitigations*）の 15 脅威のうち T1〜T10 のみを収録し、T11〜T15（Unexpected RCE /
Agent Communication Poisoning / Rogue Agents in Multi-Agent Systems /
Human Attacks on Multi-Agent Systems / Human Manipulation）を**受容と明記せずに落としている**。
本ハブは `packages/agents/src/supervisor.ts` で supervisor → specialist の多エージェント構成を
持つため、エージェント間脅威は単一エージェントの兄弟 repo よりむしろ該当性が高い。
「表に無い」と「受容した」の区別がつかない状態を解消する。

**Acceptance Criteria**

1.1 THE Agentic 側対応表 SHALL 出所タクソノミの 15 脅威それぞれに対応する節を 1 つ以上持つ。

1.2 THE Agentic 側対応表 SHALL T11〜T15 の 5 脅威それぞれについて、本ハブでの該当性の有無と
状態トークン（Requirement 2）を明記する。

1.3 THE Agentic 側対応表 SHALL Agent Communication Poisoning / Rogue Agents in Multi-Agent
Systems / Human Attacks on Multi-Agent Systems の 3 脅威について、supervisor → specialist 間で
**何を保証し何を保証しないか**を、`packages/agents/src/supervisor.ts` の現在の実装（citation
handoff・`ApprovalDeniedError` 検知による打ち切り・`WorkflowStepRunner` 経由の step 境界）を
引用して記述する。

1.4 IF ある脅威に対して本ハブが実装を持たない場合、THEN THE Agentic 側対応表 SHALL その節に
`Accepted` または `Partial · accepted` の状態トークンと再評価トリガを記し、節そのものを省略しない。

1.5 THE Agentic 側対応表 SHALL 対応を主張する各節について、実装引用とテスト引用の双方を持つ
（引用を伴わない主張を書かない。X-13 の受け入れ条件を維持する）。

1.6 THE Agentic 側対応表 SHALL 15 脅威と自文書の節の対応関係を 1 箇所で一覧できる形（脅威 ID →
節）で示し、収録漏れが目視・機械の双方で検出可能な状態にする。

### Requirement 2: 状態語彙を 3 値にし、受容行に再評価トリガを持たせる（X-18）

現状の対応表 2 文書は「対応済み」「未対応」の 2 値しか表現できず、部分対応＋残余リスク受容
（LLM05、Overwhelming Human-in-the-Loop）を区別できない。受容行がいつ見直されるべきかも
書かれていないため、受容は暗黙に永続する。出所の 3 値を verbatim で採用し、兄弟 repo との
比較可能性を保ったまま受容を明示的・期限付きにする。

**Acceptance Criteria**

2.1 THE 対応表 2 文書 SHALL 各クレームに状態トークンを 1 つだけ付与し、その値は
`Mitigated` / `Partial · accepted` / `Accepted` のいずれか（出所 verbatim、表記ゆれなし）である。

2.2 THE 対応表 2 文書 SHALL 「対応済み」「未対応」という旧 2 値を状態マーカーとして用いない。

2.3 WHEN クレームの状態トークンが `Partial · accepted` または `Accepted` である場合、
THE 対応表 2 文書 SHALL そのクレームに再評価トリガを 1 つ以上記す。

2.4 THE 再評価トリガ SHALL 具体的な将来の変更（例: 「長期会話メモリストアを導入したとき」
「supervisor specialist が破壊的ツールを呼ぶようになったとき」）として書かれ、
時間基準のみの記述（「定期的に」「次回レビューで」）を再評価トリガとしない。

2.5 THE 対応表 2 文書 SHALL 状態トークンの定義（3 値の意味と再評価トリガの義務）を各文書の
冒頭に記し、読者が表を読む前に語彙を確定できる状態にする。

2.6 THE 対応表 2 文書 SHALL 現在「未対応」と記されている 4 クレーム（LLM05 の回帰ガード不在 /
LLM07 System Prompt Leakage / Overwhelming HITL のレート制限不在 / Misaligned & Deceptive
Behaviors）を 3 値のいずれかへ再分類し、それぞれに再評価トリガを持たせる。

### Requirement 3: タクソノミ名と内容を一致させ、版を明記する（X-19）

Agentic 側対応表はファイル名が Agentic Top 10（ASI01–ASI10）を名乗るのに、内容は
レイヤ別 *Threats and Mitigations*（15 脅威）である。読者はどのタクソノミの充足を
読み取ってよいか判断できない。両文書ともタクソノミの版日付を持たないため、出所が改訂されても
対応表が古いことに気づけない。Clarification のとおり**内容側（15 脅威）を正としてファイル名を
揃える**。

**Acceptance Criteria**

3.1 THE Agentic 側対応表 SHALL 自身が実際に写像しているタクソノミ（レイヤ別
*Threats and Mitigations*、15 脅威）を名乗るファイル名を持つ。

3.2 THE Agentic 側対応表のファイル名および本文 SHALL Agentic Top 10 / ASI01–ASI10 を
名乗らない（写像していないタクソノミの充足を示唆しない）。

3.3 THE 対応表 2 文書 SHALL 各文書の冒頭に、突き合わせた出所タクソノミの名称と
バージョン日付（ISO-8601、機械可読な単一の形式）を記す。

3.4 WHEN Agentic 側対応表がリネームされた場合、THE リポジトリ SHALL 同文書を参照する
すべての箇所（`CLAUDE.md` / `AGENTS.md` / `docs/cross-repo-adoption-backlog.md` /
`docs/owasp-llm-top10-mapping.md` の相互参照）を更新し、`tests/repo/doc-links.spec.ts` が
緑である状態を保つ。

3.5 THE 対応表 2 文書 SHALL 相互参照（片方がもう片方を「対象外の脅威はあちらを参照」と指す
関係）をリネーム後も双方向に維持する。

### Requirement 4: 引用・語彙・版日付の腐敗を機械検出する（X-20）

2 文書の全 40 引用は 2026-09-22 時点で解決するが、それを守る仕組みは無く手動確認に
依存している。同じガードが X-18 の語彙と X-19 の版日付のドリフトも守れるため、
1 本のリポジトリガードに畳む（新規ワークフローファイルは作らない。principle 5）。

**Acceptance Criteria**

4.1 THE リポジトリガード SHALL 対応表 2 文書が引用するファイルパスがすべてリポジトリ内に
実在することを検査し、1 件でも解決しない場合に失敗する。

4.2 THE リポジトリガード SHALL 対応表 2 文書が引用するシンボル名（関数・定数・型）が、
引用元として示されたファイル内に実在することを検査する。

4.3 THE リポジトリガード SHALL 対応表 2 文書が引用する CI ステップ名が、引用された
`.github/workflows/*.yml` に実在することを検査する。

4.4 THE リポジトリガード SHALL 対応表 2 文書のすべての状態トークンが Requirement 2 の
3 値のいずれかであることを検査し、3 値以外のトークンを検出した場合に失敗する。

4.5 THE リポジトリガード SHALL 対応表 2 文書の双方にタクソノミバージョン日付
（Requirement 3.3 の形式）が存在することを検査する。

4.6 THE リポジトリガード SHALL 4.1〜4.5 の各検査について、走査対象が 0 件でないことを示す
非空アサートを検査本体より前に置く（走査 0 件で緑になる経路を塞ぐ）。

4.7 IF 対応表 2 文書のいずれかがリポジトリから消えるか、ガードが期待するファイル数と
一致しない場合、THEN THE リポジトリガード SHALL 失敗する（対象そのものの消失を緑にしない）。

4.8 THE リポジトリガード SHALL `repo` Vitest プロジェクトの 1 ファイルとして追加され、
新規 GitHub Actions ワークフローファイルを伴わない。

### Requirement 5: 承認リクエストからの履歴・usage・model 注入をスキーマで封鎖する（D1）

承認 API は現在 `{ toolCallId, decision, args? }` を受理するが、未定義フィールドは黙って
捨てられる（reject されない）。クライアントが会話履歴・usage・model を名乗るフィールドを
送っても 200 系が返るため、「偽造履歴がモデルに到達しない」ことを応答から確認できない。
出所レーンはこれを*フィールドとして定義しない*ことを要件化し、余剰フィールドを 422 で落とし、
到達しないことをテストで証明している。

**Acceptance Criteria**

5.1 THE 承認 API のリクエストスキーマ SHALL 会話履歴・usage・model に相当するフィールドを
定義しない（サーバ側に永続した状態のみが再開の入力になる）。

5.2 WHEN リクエストボディがスキーマに定義されていないフィールドを 1 つでも含む場合、
THE 承認 API SHALL 400 を返し、ワークフローを再開しない。

5.3 WHEN クライアントが会話履歴・usage・model を名乗るフィールドをリクエスト本体の
トップレベルに含めて承認を送った場合、THE 承認 API SHALL 5.2 により拒否し、当該リクエスト
由来の値がモデル入力・エンジンへ送る承認シグナル・監査記録のいずれにも現れない。
本保証は `args` の値そのもの（kind 別 `specialistInputSchema.parse` を経由する）には及ばない
——`z.unknown()` を入力スキーマとする kind（現状 `data-processing` のみ）に限り、args 内の
偽造フィールドがそのまま通過し得ることを対応表に `Partial · accepted` として明記する
（Requirement 1/2 が扱う）。

5.4 THE 承認 API SHALL 再開後にモデルへ渡るメッセージ列を、サーバ側に永続した plan / step /
既存の step 結果のみから構成する。

5.5 IF リクエストが 5.2 で拒否された場合、THEN THE 承認 API SHALL 承認対象を消費せず、
正しいボディでの再送が引き続き成立する状態を保つ。

### Requirement 6: 承認対象の consume-once と存在秘匿（D2）

同じ承認対象へ 2 度目の決定を送れる現状は、リプレイと列挙の双方に開いている。
承認対象が未知か / いま suspend していないか / 既に消費済みかを応答の差から判別できると、
攻撃者は他人のジョブの進行状況を観測できる。出所レーンはこの 3 ケースを単一の 404 に畳み、
本文に識別子も状態語も載せない。

**Acceptance Criteria**

6.1 WHEN 同一の承認対象に対して 2 度目の決定が送られた場合、THE 承認 API SHALL 2 度目を
拒否し、ワークフローを再開しない（consume-once）。

6.2 WHEN 承認対象が (a) 存在しない / (b) 現在 suspend しておらず決定を受け付けられない /
(c) 既に消費済み のいずれかである場合、THE 承認 API SHALL 同一の投稿形（単一形 / セット形）に
おいて 3 ケースを常に同一のステータスと同一のレスポンスボディへ畳む（単一形は 404、セット形は
Requirement 9 の 409 に畳んでよい。本要件の実質はケース間の区別不能性であり、ステータス値
そのものの固定ではない — Requirement 6.4 が検証する）。

6.3 THE 承認 API の 404 応答ボディ SHALL 承認対象の識別子と状態語（unknown / in-flight /
consumed に相当する語）を含まない。

6.4 THE 承認 API SHALL 6.2 の 3 ケースを応答ヘッダ・応答ボディ・クライアントへ返す
エラーコードの差によって区別可能にしない。

6.5 THE 承認 API SHALL ジョブ単位の既存の認可ラダー（`authorizeJobAccess` の
400 / 401 / 404 / 403、R5.1）を変更しない。存在秘匿は承認対象の単位に適用し、
ジョブ単位の 403 の扱いは本 spec のスコープ外とする。

6.6 THE 承認 API SHALL consume-once の記録をワーカー／web プロセスの再起動を跨いで保持する
（プロセス内メモリのみに置かない）。

### Requirement 7: suspend/resume を跨ぐ usage 予算（D3）

chat 経路は `stopWhen` にトークン予算を持つが、job/approval 経路は suspend/resume を跨いで
累積使用量を持たない。承認のたびにモデル実行が再開されるため、予算は境界を跨いで積算しなければ
意味を持たない（1 ステップずつは予算内でも、ジョブ全体では無制限に消費できる）。

**Acceptance Criteria**

7.1 THE job/approval 経路 SHALL 1 ジョブの累積トークン使用量を、step 境界と
suspend/resume 境界を跨いで積算して保持する。現状 usage を報告する specialist は
`document-generation` のみであるため、本要件が実質カバーする範囲もそれに限られる点を
対応表に `Partial · accepted` ＋ 再評価トリガ（他の specialist 種別がモデルを直接呼ぶように
なったとき）として明記する（Requirement 1/2 が扱う）。

7.2 WHILE あるジョブの累積使用量が予算上限に達している状態で、WHEN そのジョブへ承認が
送られた場合、THE 承認 API SHALL 429 を返し、ワークフローを再開しない。

7.3 WHEN 7.2 により 429 を返す場合、THE 承認 API SHALL その承認対象を消費済みにする
（同一対象での再試行が再開経路を再び開かない）。

7.4 THE 予算上限 SHALL 環境変数で設定可能であり、既定値を持つ（未設定の環境で既存の
ジョブ実行が失敗しない）。

7.5 WHERE 累積使用量を `JobEvent` で配信する場合、THE `JobEvent` の当該フィールド SHALL
optional であり、当該フィールドを知らない既存の SSE コンシューマがそのまま動作する。

7.6 THE job/approval 経路 SHALL 累積使用量を、承認 API から送られた値ではなく
サーバ側で観測した使用量から算出する（Requirement 5.1 と整合）。

### Requirement 8: 編集済み引数のマスク監査と単一 fail-soft 境界（D4）

承認時の引数編集（`args`）は、ユーザーが送った値がそのまま破壊的ツールの入力になる経路である。
値を監査へ生で残すと R4.7 のプライバシー契約に反し、一方で監査を必須にすると監査シンクの障害が
人間の承認を失敗させる。出所レーンは**キー名のみ記録**し、シンクの失敗を resume の失敗に
しないことで両方を満たす。

**Acceptance Criteria**

8.1 WHEN 承認が編集済み `args` を伴う場合、THE 承認 API SHALL 上書きされたキー名のみを
監査へ記録し、その値を記録しない。

8.2 THE 承認 API SHALL 8.1 の記録を単一の境界（1 箇所の発火点）で行い、承認経路に第 2 の
監査発火点を作らない。

8.3 IF 監査シンクが失敗した場合、THEN THE 承認 API SHALL 再開を失敗させず、
成功時と同じステータスを返す。

8.4 WHEN 監査シンクが失敗した場合、THE 承認 API SHALL raw な `args` の値・生のプロンプトを
含まないログのみを出力する（R4.7）。

8.5 THE リポジトリ SHALL 既存のツール実行監査（`packages/agents/src/audit-hook.ts` を
発火点とする経路）の fail-loud 方針を変更しない。fail-soft は承認経路の監査境界に限る。

8.6 THE 承認 API SHALL 8.1 の記録に、誰の（`callerId`）どのジョブの（`jobId`）どの承認対象への
決定かを追跡できる識別子を含める（Repudiation & Untraceability への対応を後退させない）。

### Requirement 9: pending set の原子性（D5）

決定を 1 件ずつ受け付ける現状では、複数の承認対象を持つジョブに対して「一部だけ適用された
中途半端な状態」が生じうる。出所レーンは 1 つでも不正な識別子があればツールを 1 つも
実行せずに 409 で決定セット全体を拒否する。

**Acceptance Criteria**

9.1 THE 承認 API SHALL 1 リクエストで複数の決定（決定セット）を受理できる。

9.2 WHEN 決定セットのうち 1 件でも pending set に存在しない承認対象を含む場合、
THE 承認 API SHALL いずれのステップも再開せず、409 で決定セット全体を拒否する。

9.3 WHEN 決定セット内に同一の承認対象が 2 回以上現れる場合、THE 承認 API SHALL 409 で
決定セット全体を拒否する。

9.4 THE 承認 API SHALL 既存の単一決定ボディ（`{ toolCallId, decision, args? }`）を
引き続き受理し、`apps/web/src/features/jobs/ApprovalPanel.tsx` の既存の呼び出しを壊さない。

9.5 THE 承認 API の 409 応答ボディ SHALL どの承認対象が不正だったかを列挙しない
（Requirement 6.3 の存在秘匿と整合する）。

9.6 IF 決定セットが 9.2 / 9.3 で拒否された場合、THEN THE 承認 API SHALL セット内の
いずれの承認対象も消費せず、監査へツール実行を記録しない。

### Requirement 10: egress ポリシー迂回の回帰スキャン（D6）

`RECIPIENT_ALLOWLIST` は committed・空初期値の第 2 ゲートだが、それを迂回するコード
（宛先文字列の直書き、チェックの短絡）が後から混入しても機械的には検出されない。
出所レーンは自レーンの `src/` を走査して迂回リテラルを落とすテストを持つ（CVE を引用）。

**Acceptance Criteria**

10.1 THE リポジトリガード SHALL アプリ／パッケージのソース（`apps/*/src/**`、
`packages/*/src/**`）を走査し、`RECIPIENT_ALLOWLIST` を経由せずに宛先を決定するリテラル、
および許可リスト判定を無効化する記述の混入を検出して失敗する。

10.2 THE リポジトリガード SHALL 走査対象ファイル数が 0 件でないことを示す非空アサートを
検査本体より前に置く。

10.3 THE リポジトリガード SHALL テストフィクスチャ・文書・許可リスト定義そのものを
偽陽性にしない。許容する例外は列挙され、その列挙が空でないこと／各例外パスが実在することを
検査する。

10.4 THE リポジトリガード SHALL 出所（`pydantic-ai-sandbox` の対応テストと、そこで引用された
CVE 番号）をドックコメントに明記する（兄弟 repo のパスはコードスパンで書き、
`tests/repo/doc-links.spec.ts` を壊さない）。

10.5 THE リポジトリガード SHALL `repo` Vitest プロジェクトに追加され、新規 GitHub Actions
ワークフローファイルを伴わない。

### Requirement 11: 着地を正本へ追記し、参照の解決性を保つ

正本レビューは追記のみ規約で運用されている（過去の結果は書き換えない、時点の記録）。
一方 Requirement 3 のリネームは、正本 §7.6 および `specs/review/2026-09-22-cross-repo-verification.md`
が持つ**旧ファイル名への相対リンク**を解決不能にする。`tests/repo/doc-links.spec.ts` は
それを落とすため、「追記のみ」と「リンクが解決する」を同時に満たす扱いを明示的に決める必要がある。

**Acceptance Criteria**

11.1 THE リポジトリ SHALL 正本レビュー `docs/cross-repo-adoption-review.md` の §1〜§7 の
主張・測定値・判定を改変しない。

11.2 THE リポジトリ SHALL 本 spec の着地を、日付付きの §8 addendum として正本レビューへ
追記する。

11.3 THE §8 addendum SHALL X-17 / X-18 / X-19 / X-20 と D1〜D6 のそれぞれについて
着地・非着地を明記し、非着地の項目には理由を記す。

11.4 IF Requirement 3 のリネームにより追記のみ規約の文書内の相対リンクが解決しなくなる場合、
THEN THE リポジトリ SHALL 主張を一切変えずリンク先のみを是正し、その是正を §8 addendum に
「本文の改変ではなくリンク先の是正」として記録する。

11.5 THE リポジトリ SHALL `docs/cross-repo-adoption-backlog.md` §5 の X-17〜X-20 の各項目に
本 spec による解決を反映し、起票のまま残さない。

11.6 THE リポジトリ SHALL 本 spec が追加・改訂した文書について、本リポジトリ内の文書は
リンク、兄弟リポジトリのパスはコードスパンで書く規約を守る
（`tests/repo/doc-links.spec.ts` と `tests/repo/cross-repo-reference-resolution.spec.ts` が
ともに緑である）。

11.7 THE §8 addendum SHALL D1〜D6 の実装が `apps/web` の job/approval 経路に限られること、
および `/api/chat` と `services/api` を対象外としたことを明記する。

### Requirement 12: 検証ゲートと非空虚性

本 spec の成果物は「文書 4 項目」と「経路 6 防御」に分かれるが、どちらも既存ゲートの上で
緑であることが完了条件である。憲章 principle 3 の非空虚性（実装を壊したときに落ちることを
確認していないテストはテストとして数えない）を、本 spec が追加するすべての検査に適用する。

**Acceptance Criteria**

12.1 WHEN 本 spec の変更が完了した時点で、THE リポジトリ SHALL `mise run check`
（lint / typecheck / unit test / audit）が緑である。

12.2 THE リポジトリ SHALL 本 spec で新規 GitHub Actions ワークフローファイルを追加しない
（X-14、principle 5）。既存 6 本の上で走る。

12.3 THE リポジトリ SHALL 本 spec の変更後も `scripts/forbid-model-ids.sh`（`lint:model-ids`）が
緑である（モデル文字列を新たな場所へ書かない）。

12.4 THE 本 spec が追加する各テスト SHALL 対応する実装・文書を壊したときに落ちることを
確認済みである（Requirement 4 / 10 のガードは非空アサートを併せ持つ）。

12.5 THE 承認 API の Requirement 5〜9 の振る舞い SHALL ネットワークを開かないテストで
検証される（`MockLanguageModelV4` などの既存シームを用い、実 LLM・実 Redis を要求しない）。

12.6 THE リポジトリ SHALL カバレッジ閾値（lines / functions ≥ 80%）を下回らない。

12.7 THE リポジトリ SHALL 本 spec の各受け入れ基準 ID と実装・テストの対応を
`specs/007-cross-repo-adoption-closeout/` 配下のトレーサビリティ記録として残す。

## Non-Functional Requirements

- **プライバシー（R4.7）**: 本 spec が追加するログ出力は、生のユーザープロンプト・生のツール
  入出力・編集済み `args` の値を `fields` に含めない。ツール引数を残す唯一の許可された場所は
  監査ログであり、そこでも編集済み引数は**キー名のみ**（Requirement 8.1）。
- **ワイヤ後方互換**: `JobEvent` へフィールドを追加する場合は optional のみ（SSE 契約）。
  `JobEvent.ts` は ISO 文字列、`AuditEntry.ts` は `Date` の区別を維持する。
- **依存方向**: `packages/agents` / `packages/tools` から `apps/web` への依存を作らない。
  承認経路の新しい状態（consume-once 記録・累積使用量）を置く場所は既存の一方向依存グラフ
  （`schemas`/`db` → `config`/`tools`/`rag` → `agents` → `web`/`worker`）を反転させない。
- **ADR-3（DI）**: 新規コードは `new Date()` を用いず `deps.now()` を読む。時刻はテストで
  固定可能であること。
- **ADR-2（エンジン非依存）**: Inngest SDK を import するファイルを
  `apps/worker/src/inngest.ts` から増やさない。
- **観測性**: 承認 API が新たに返す 404 / 409 / 429 は、応答本文で状態を漏らさない一方で、
  運用者がサーバ側ログ・監査から原因を特定できること。
- **性能**: 承認 API の追加検査（consume-once 判定・累積使用量の読み出し）は、1 リクエストあたり
  追加の DB ラウンドトリップを 2 回以内に収める。
- **文書の可読性**: 対応表 2 文書は状態トークン・再評価トリガの追加後も、1 脅威 1 節の構造を
  保ち、散文は日本語・識別子とパスは英語の既存規約に従う。
- **ガードの実行コスト**: Requirement 4 / 10 のガードは `repo` プロジェクトの実行時間を
  体感で悪化させない（ファイル走査は 1 回のツリー走査に収める）。

## Out of Scope / Future Work

本 spec で意図的に扱わない項目（Scope の Out of scope を受け入れ基準の観点で再掲・補足する）:

- **X-9 の `apps/worker` 側 `requiresApprovalForKind` クローズ** — `workflowStepSchema` への
  ステップ単位承認フラグ追加という横断的変更を要する。本 spec の D1〜D6 は既存の suspend/resume
  経路の上に載る防御であり、どのステップが承認を要するかの決定は変えない。
- **ジョブ単位の 403 が持つ存在漏洩** — `authorizeJobAccess` の 403 は他人のジョブの存在を
  明かすが、既存のテスト済み・意図された R5.1 の挙動である（Requirement 6.5）。承認対象単位の
  存在秘匿とは別の判断として残す。
- **`/api/chat` の「サーバ側履歴が正」への転換** — `useChat` がクライアント側履歴を送る前提を
  変える別設計判断。D1 は job/approval 経路のみに適用する。
- **`services/api`** — verbatim `git subtree` 取り込みであり上流の所有物。本 spec は変更しない。
- **停止理由語彙（X-5）の強制統一** — 正本 §3 のとおり写像表までで別スコープ。
- **承認要求のレート制限・大量発生の検知** — Overwhelming HITL の能動的対策。本 spec では
  Requirement 2.6 により受容として明記し再評価トリガを持たせるところまでを扱う。
- **`agentic-ai-bootcamp` と `agentic-ai-sandbox/learn/` の二方向フォークの正本決定** —
  正本 §7.4 のとおり観察のみ。本リポジトリの関与範囲外。

---

_Initialized: 2026-09-22T09:39:50+0900_
