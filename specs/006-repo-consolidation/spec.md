# 006-repo-consolidation

## Project Description

「Agentic AI アプリ開発の基礎からのガイド ＋ 実装テンプレート」として Agentic AI 系リポジトリ群を
統合する。入力は添付の統合計画（2026-09-21）であり、本 spec はそれを**実装可能な粒度へ落とす**。

統合計画の結論は「`vaz-ai-next` を統合ハブへ昇格させる」であり、その根拠（polyglot レーン分離・
durable HITL・3 層 evals・境界契約 codegen が**既に動いている**）は本 spec の再実測でも維持される。
ユーザ判断により、統合計画 §8 の未決定事項 1・2 は次のとおり確定した:

- **リネームする**: `vaz-ai-next` → `vaz-agentic-ai-next`
- **同名の既存リポジトリを畳む**: ただし後述のとおり**前提が誤っていた**ため手順を改める

### 本 spec が統合計画から変更した 3 つの前提

統合計画は §9 で「相互参照する backlog / review 文書は正確だが**抜粋であり時点の記録**なので、
判断材料にする前に必ず実クローンで実測すること」を自ら教訓として掲げている。本 spec はその規律を
統合計画自身に適用した。結果、**3 つの前提が事実と異なっていた**。

#### 前提誤り 1（最重要）— `vaz-agentic-ai-next` は空ではない

統合計画 §6.1 案 B は同リポジトリを「**中身ゼロ**」、§8-2 は「**空の** `vaz-agentic-ai-next` の
畳み方」と記述する。実測（2026-09-21、`git ls-remote` ＋ 各ブランチの `git ls-tree`）:

| 事実 | 実測値 |
|---|---|
| `main` ブランチ | 1 コミット・3 ファイル（`.gitignore` / `LICENSE` / `README.md`）→ **統合計画の記述はここだけを見れば正しい** |
| `main` 以外のブランチ | **6 本**（`001-agentic-ai-core`, `claude/agentic-ai-repo-design-3k8e32`, `claude/agentic-ai-app-spec-xo42j1`, `claude/attachment-spec-review-2g4d21`, `claude/sharp-hopper-kbrpfo`, `claude/spec-agentic-001-review-jf4dcd`） |
| `claude/agentic-ai-repo-design-3k8e32` の内容 | 14 ファイル。下表のとおり |

削除で失われるもの（行数は `git show FETCH_HEAD:<path> \| wc -l` の実測）:

| ファイル | 行数 | 本統合における意味 |
|---|---:|---|
| `docs/cross-repo-adoption-review.md` | 493 | **統合計画 §4.1 が「現状最大の構造的負債」と呼び Phase 0 の唯一の対象とした、その欠損正本そのもの**。ユーザ添付ファイルと **byte 単位で一致**（`diff` 済み） |
| `specs/001-agentic-ai-core-p0/spec-agenticai-core.md` | 1,806 | 53 要件・v1.7・**approved**。§0.3.1 に X-5/X-10/X-13/X-14 の反映表 |
| `specs/001-agentic-ai-core-p0/plan.md` | 1,338 | 同 spec の設計書 |
| `specs/001-agentic-ai-core-p0/tasks.md` | 662 | T-0〜T-3 ほか。境界スコープ済み |
| `specs/memory/constitution.md` | 296 | **11 原則**。正本レビューが「憲章 principle 8」「§5.1 の多エージェント採用ゲート」として**規範参照**している当の文書 |
| `specs/001-agentic-ai-core-p0/{research,traceability}.md` ＋ `spec.{md,json}` | 430+ | 調査記録・トレーサビリティ |
| `CLAUDE.md` / `AGENTS.md` | 241 / 141 | 正本レビュー X-4 が「`.sdd/` を ignore のまま必要なものだけ追跡下へ移す」**解法の前例**として全 repo に推奨している当の実装 |

合計 **約 5,400 行**。「空リポジトリの削除」ではなく、**統合の入力資産そのものの破棄**である。
したがって R1（退避）を R2（名前空け）の**強い前提条件**として先行させる。

#### 前提誤り 2 — Phase 0 の dangling 参照張り替えは**不要**（リネームが自動解決する）

統合計画 §7 Phase 0 は「3 repo の dangling 参照を張り替え（各 1 行）」を作業に数える。実測すると
参照は **7 箇所 / 7 ファイル / 3 repo** で、そのすべてが
`vaz-agentic-ai-next/docs/cross-repo-adoption-review.md` を指している:

```
fastapi-pydantic-ai-agent/CLAUDE.md:259          fastapi-pydantic-ai-agent/AGENTS.md:170
fastapi-pydantic-ai-agent/docs/cross-repo-adoption-backlog.md:4
pydantic-ai-sandbox/docs/README.md:22            pydantic-ai-sandbox/docs/cross-repo-adoption-backlog.md:4
vaz-ai-next/docs/cross-repo-adoption-backlog.md:4
vaz-ai-next/docs/context-budget.md:70
```

リネーム後、ハブは `vaz-agentic-ai-next` であり正本は `docs/cross-repo-adoption-review.md` に置かれる。
**7 参照はすべて編集ゼロで解決する。** Phase 0 の作業は「張り替え」ではなく「設置」だけになる。
**ゆえにリネーム（R2）は正本設置（R3）より前に置く。** 統合計画は逆順を想定していた。

#### 前提誤り 3 — X-1 の行は stale（正本レビューは 2026-09-06 時点の記録）

正本レビュー §1 の `vaz-ai-next` 列は「Actions SHA 固定 **0 / 22**」「workflow `permissions:` **0 / 6**」
と記録する。2026-09-21 の再実測:

```
uses: 総数 28 / SHA 固定 28  (28/28)      permissions: 宣言 6 / workflow 6  (6/6)
```

X-1 は**着地済み**（統合計画 §3.1 の記述が正しい）。正本レビューは点時記録であり誤りではないが、
設置時に無注釈だと「未着地の課題」として読まれる。R3.3 の addendum で再実測値を併記する。

### 統合計画に無かった設計論点（本 spec が新規に起票）

再実測の過程で、統合計画が識別していない衝突を 3 件検出した。いずれも Phase 2 以降の
**着手時に必ず踏む**ため、事前に裁定する。

1. **spec 採番衝突と組み立て機構の逆向き設計**（→ R4 / ADR-0003）。継承する
   `001-agentic-ai-core-p0` はハブ既存の `001-vaz-ai-update` と番号衝突する。さらに同 spec は
   「**新リポジトリ側が vaz-ai-next を取り込む**」向きで書かれており（`spec.json.repository.note`:
   "This repository is NOT vaz-ai-next. vaz-ai-next is an upstream repository whose contents are
   imported by T-0."）、本統合とは向きが逆である。
2. **model-ID ゲートの衝突**（→ R6.4）。`scripts/forbid-model-ids.sh` は `services/**/*.py` を走査する。
   取り込み対象を実際に走査した結果は R6.4 に実測値で記載。
3. **停止理由語彙の同居**（→ R8.3 / ADR-0004）。正本レビュー X-5 は「**今回は統一しない**。写像表を
   先に固定し、**両方を抱える** `vaz-agentic-ai-next` の設計判断材料にする」と述べる。Phase 2 完了時点で
   ハブは TS 4 値と Python 5 値を 1 リポジトリに同居させる。X-5 が「決めておく必要がある」とした
   条件が**成立する**。

---

## Clarifications

### Session 2026-09-21（ユーザ判断 ＋ 再実測で確定した事項）

- **リネーム方式は「退避 → 名前空け → rename」の 3 段**。GitHub は旧 URL を自動リダイレクトするため
  **ハイパーリンクは生存する**が、`vaz-ai-next/docs/...` のような**文字列としてのパス参照は
  リダイレクトされない**。両者を混同しないこと（R2.5）。
- **名前空けの既定は削除ではなく `-archive` へのリネーム**。ユーザ指示は「削除」だが、それは
  「空リポジトリ」という前提の下での指示であり、前提は成立しない（前提誤り 1）。目的は
  「`vaz-agentic-ai-next` という名前を空けること」であり、これは archive リネームでも
  **完全に達成される**うえ**可逆**である。削除は不可逆かつ 6 ブランチを道連れにする。
  **退避完了の検証後、ユーザが明示的に削除を選んだ場合のみ削除する**（R2.2 / R2.3）。
- **`@vaz/*` パッケージ scope は変更しない**。scope は `@vaz` であって `@vaz-ai-next` ではないため、
  9 パッケージ（`@vaz/web` `@vaz/worker` `@vaz/{agents,config,db,evals,rag,schemas,tools}`）は
  リネームの影響を受けない。リテラル `vaz-ai-next` を持つのは**実測 5 箇所のみ**（R2.4）。
- **正本レビューは verbatim で設置し、改変しない**。`pydantic-ai-agentic-patterns/CLAUDE.md` の
  「レビュー文書は**追記のみ**で、過去の結果は書き換えない（時点の記録）」を全 repo 共通規約として
  適用する。同一性崩壊（`vaz-ai-next` 列と `vaz-agentic-ai-next` 列が 1 本に畳まれる）と stale 行は
  **本文改変ではなく日付付き addendum** で解決する（R3.2 / R3.3）。
- **継承 spec は「要件は継承・機構は supersede」**。`001-agentic-ai-core-p0` の 53 要件（chat / HITL /
  RAG / 可観測性 / CI）は製品要件として有効。組み立て機構（T-0「母体 monorepo の取り込み」、
  T-1.2 `turbo.json` 新設、T-1.3 ルート `pyproject.toml` 新設、T-2 `apps/agent-api`）は
  本統合が**リネームによる同一性移行**を採るため成立しない。ADR-0003 で明示的に supersede する。
- **ルート uv workspace と Turborepo は採らない**。これは統合計画 §4.2・§5.1 の判断であると同時に、
  **継承 spec 自身の結論でもある**: 同 spec `tasks.md` T-1.3 の ADR-P0-05 は「候補 (a):
  `apps/agent-api` を uv workspace のメンバーに**含めない**。独自 `uv.lock` を持ち、Turborepo の
  Python 管理外となる。Python タスクは `mise` 直接実行（退避経路 — ADR-P0-01）で運用する」を
  採用決定としている。**両文書は独立に同じ結論へ到達している**。本 spec はその極限形
  （ルート `pyproject.toml` / `turbo.json` を**そもそも作らない**）を採る。
  - 補強: 統合計画 §5.1 は Turborepo の Python 対応が 2.10.13 で `FutureFlags` 下の **experimental**
    であることを出典つきで記録。継承 spec §12 R14 も「どのメンバーを uv workspace に含めるかは
    Turborepo の採否と同一の決定」と述べる。
  - 帰結: 統合計画 §4.2 の「訂正記録」（`fastapi>=0.141.1` と `fastapi<0.137` の衝突は
    単一 uv workspace 前提の誤りだった）は**本 spec でも維持される**。独立レーンである限り同居可能。
    実測: `services/agent` = `fastapi>=0.141.1`、`fastapi-pydantic-ai-agent` = `fastapi>=0.136.3,<0.137`。
    **両者とも `requires-python = ">=3.13"`** であり、インタプリタ競合は無い。
- **点時記録ディレクトリはリネームしない**。`pydantic-ai-agentic-patterns/specs/review/vaz-ai-next/`
  は「その名前だったリポジトリに対する、その時点のレビュー」であり、追記のみ規約の対象。
  ディレクトリ名は保持し、`specs/review/INDEX.md` に 1 行の注記を足す（R9.2）。
- **beeai-agentic-ai-sandbox は本セッションのスコープ外**。正本レビューは 5 repo 横断だが、
  本セッションに attach されているのは 4 repo ＋ ハブ。beeai に対する取り込み（正本レビュー §5 の
  `X-4` 最優先ほか）は**本 spec の境界外**とし、R9.3 で申し送る。

---

## Requirements

<!--
EARS 形式（rules/ears-format.md）。受入基準は階層番号で採番し plan.md / tasks.md の
トレーサビリティキーとする。既定主語 THE VAZ platform。
[E]=Event-driven / [U]=Ubiquitous / [S]=State-driven / [O]=Optional
-->

### Requirement 1: 継承資産の退避（P0・他のすべてに先行）

**User Story**: 保守者として、名前空けの前に `vaz-agentic-ai-next` の全ブランチ資産が
ハブ側で復元可能になっていてほしい。理由: 統合計画は同リポジトリを「空」と誤認しており、
その前提のまま畳むと正本レビュー・53 要件の P0 spec・11 原則の憲章（約 5,400 行）を失う。

**Acceptance Criteria**:

1.1 [E] WHEN 退避が実行される時, THE VAZ platform SHALL fetch **全 6 非 main ブランチ**
（`001-agentic-ai-core`, `claude/agentic-ai-repo-design-3k8e32`, `claude/agentic-ai-app-spec-xo42j1`,
`claude/attachment-spec-review-2g4d21`, `claude/sharp-hopper-kbrpfo`, `claude/spec-agentic-001-review-jf4dcd`）
し、各ブランチの tip SHA を `specs/006-repo-consolidation/pdca/do.md` に記録する。
1.2 [U] 退避成果 SHALL be pushed to ハブの退避ブランチ `archive/vaz-agentic-ai-next` as
**履歴を保つ形**（`git fetch` した ref を `git push origin <sha>:refs/heads/archive/...`）。
単なるファイルコピーは SHALL NOT be the only form of 退避（コミット履歴と作成者情報が失われるため）。
1.3 [E] WHEN 退避が完了した時, THE VAZ platform SHALL verify 下表の 9 ファイルすべてがハブから
読み出せること。検証は**行数一致**で行う（`git show archive/...:<path> | wc -l`）:
`docs/cross-repo-adoption-review.md`=493, `specs/001-agentic-ai-core-p0/spec-agenticai-core.md`=1806,
`specs/001-agentic-ai-core-p0/plan.md`=1338, `specs/001-agentic-ai-core-p0/tasks.md`=662,
`specs/memory/constitution.md`=296, `specs/001-agentic-ai-core-p0/research.md`=330,
`specs/001-agentic-ai-core-p0/traceability.md`=100, `CLAUDE.md`=241, `AGENTS.md`=141。
1.4 [U] 退避の検証結果 SHALL be recorded in `pdca/do.md` **before** R2 の名前空けに着手する。
未検証の状態で R2 に進むことは SHALL NOT be permitted。
1.5 [O] WHERE `001-agentic-ai-core` 以外の 4 本の `claude/*` ブランチが
`claude/agentic-ai-repo-design-3k8e32` の部分集合であると差分検証で確認された場合,
それらは退避ブランチへの push を SHALL be allowed to skip（SHA の記録は 1.1 により必須）。

### Requirement 2: 同一性の移行（名前空け → rename → リテラル更新）

**User Story**: 利用者として、リポジトリ名がその正体（Agentic AI のガイド／テンプレート）を
表していてほしい。理由: `vaz-ai-next` という名前からは polyglot な統合ハブであることが読めず、
3 repo が既に `vaz-agentic-ai-next` を正本参照先として書いている。

**Acceptance Criteria**:

2.1 [U] THE VAZ platform SHALL NOT delete `Fukuchan77/vaz-agentic-ai-next` as 既定手順。
名前空けの既定は `vaz-agentic-ai-next` → **`vaz-agentic-ai-next-archive`** へのリネームとする
（可逆・全ブランチ保全・名前空けの目的は完全に達成される）。
2.2 [O] WHERE ユーザが R1 の退避検証結果を確認したうえで**明示的に削除を選択した場合**,
THE VAZ platform SHALL perform the deletion。削除は R1.3 の 9 ファイル検証が green である
ことを SHALL require as 前提条件。
2.3 [E] WHEN 名前が空いた時, THE VAZ platform SHALL rename `Fukuchan77/vaz-ai-next` →
`Fukuchan77/vaz-agentic-ai-next`。可視性は **public (MIT) のまま維持**する（統合計画 §8-4:
書籍関連の公開意図と整合）。
2.4 [E] WHEN リネームが完了した時, THE VAZ platform SHALL update リテラル `vaz-ai-next` を
持つ**実測 5 箇所 ＋ README**:

| # | ファイル | 現在値 | 種別 |
|---|---|---|---|
| 1 | `package.json:2` | `"name": "vaz-ai-next"` | ルートパッケージ名 |
| 2 | `apps/web/src/app/layout.tsx:6` | `title: "vaz-ai-next"` | ブラウザタブ |
| 3 | `apps/web/src/features/chat/Chat.tsx:124` | `<h1>vaz-ai-next</h1>` | **UI 見出し** |
| 4 | `apps/web/tests/e2e/home.spec.ts:6` | `getByRole("heading", { name: "vaz-ai-next" })` | E2E アサート |
| 5 | `apps/web/tests/e2e/a11y.spec.ts:18` | 同上 | E2E アサート |
| 6 | `README.md:1` | `<h1 align="center">VAZ-AI-Next</h1>` | 表題 |

2.5 [U] 3 と 4・5 SHALL be changed in **同一コミット**。UI 見出しの変更は 2 本の E2E spec を
同時に壊すため、分割コミットは pre-push フック（Playwright）を赤にする。
2.6 [U] `@vaz/*` パッケージ scope（9 パッケージ）SHALL NOT be renamed。scope は `@vaz` であり
リポジトリ名に依存しない。
2.7 [U] 既存の**点時記録**（`specs/00{1,3,5}-*/` 配下の `vaz-ai-next` 言及、計 9 箇所）
SHALL NOT be rewritten。追記のみ規約の対象であり、当時のリポジトリ名の記録として正しい。
2.8 [U] THE VAZ platform SHALL rely on GitHub の旧 URL 自動リダイレクト for ハイパーリンク、
but SHALL NOT rely on it for **文字列としてのパス参照**（`vaz-ai-next/docs/...` 形式）。
後者は R9.1 の対象。

### Requirement 3: 正本 `cross-repo-adoption-review.md` の設置

**User Story**: 5 repo の保守者として、X-1〜X-16 の ID 体系の本文が実在してほしい。
理由: 3 repo・7 箇所が正本として参照しているが実体が無く、統合計画はこれを
「現状最大の構造的負債」と位置づけている。

**Acceptance Criteria**:

3.1 [E] WHEN 正本が設置される時, THE VAZ platform SHALL place it at
`docs/cross-repo-adoption-review.md` **verbatim（493 行、本文改変なし）**。
出所は R1 で退避した `archive/vaz-agentic-ai-next` の
`claude/agentic-ai-repo-design-3k8e32` 系列とし、`pdca/do.md` に出所 SHA を記録する。
3.2 [U] 本文の末尾に **`## §6 追記（2026-09-21）— 同一性の崩壊と再実測`** を SHALL add。
`§1` 横断マトリクスの `vaz-ai-next` 列と `vaz-agentic-ai-next` 列が 1 本に畳まれた事実を
写像表で記録する:

| 正本 §1 の列 | 統合後 | 扱い |
|---|---|---|
| `vaz-ai-next` | **ハブ本体**（実装・CI・依存の実測値はこの列が正） | 統合 |
| `vaz-agentic-ai-next` | **ハブの仕様層**（憲章・P0 spec・REQ-7.5/7.6 の非空アサート） | 統合 |

3.3 [U] 同 addendum SHALL record 再実測により stale となった行:
`Actions SHA 固定 0/22 → **28/28**`、`workflow permissions: 0/6 → **6/6**`（X-1 着地済み）。
**本文の当該セルは書き換えない**（点時記録の保全）。
3.4 [E] WHEN 正本が設置され、かつ R2.3 のリネームが完了した時, THE VAZ platform SHALL verify
**7 件の dangling 参照が編集ゼロで解決する**ことを機械的に確認する（R9.1 の検証スクリプト）。
3.5 [U] 本 spec SHALL NOT 正本の §1〜§5 本文を編集する。同一性崩壊・stale・スコープ変更は
すべて §6 addendum で扱う。

### Requirement 4: 憲章と継承 spec の受け入れ

**User Story**: 保守者として、正本レビューが規範参照する憲章がハブの追跡下にあってほしい。
理由: 正本レビューは「憲章 principle 8（事実は測定で決める）」「憲章 §5.1 の多エージェント採用ゲート」
「憲章 principle 2（Protocol で拡張）」を根拠として繰り返し引用するが、ハブに憲章は存在しない
（`specs/memory/` も `.sdd/` も無いことを実測で確認）。

**Acceptance Criteria**:

4.1 [E] WHEN 憲章が受け入れられる時, THE VAZ platform SHALL place it at
`specs/memory/constitution.md`（296 行・11 原則・v1.2.0）verbatim。
配置先は継承 spec の `spec.json.constitution.path` と同一であり、参照が自動的に解決する。
4.2 [U] 継承 spec は **`specs/001-agentic-ai-core-p0/` のまま置かない**。ハブの
`specs/001-vaz-ai-update/` と採番衝突するため、**`specs/inherited/001-agentic-ai-core-p0/`**
配下へ置く。ハブの連番体系（`001`〜`006`）は SHALL NOT be renumbered。
4.3 [U] 継承 spec の 53 要件 SHALL be treated as 有効な製品要件（chat / HITL / RAG / 可観測性 / CI）。
4.4 [U] 継承 spec の**組み立て機構** SHALL be superseded by 本 spec、and この裁定 SHALL be
recorded as **`docs/adr/0003-consolidation-direction.md`**。supersede 対象を明示列挙する:
`T-0`（母体 monorepo の取り込み）/ `T-1.2`（`turbo.json` 新設）/ `T-1.3`（ルート `pyproject.toml` 新設）/
`T-2`（`apps/agent-api` への移植）。
4.5 [U] ADR-0003 SHALL record 「両文書が独立に同じ結論へ到達した」事実: 継承 spec の
**ADR-P0-05 候補 (a)**（`apps/agent-api` を uv workspace メンバーに含めない・独自 lock・
mise 直接実行）と統合計画 §4.2（ルート `pyproject.toml`/`uv.lock` を持たない独立レーン）は
同一方向であり、本 spec はその極限形を採る。
4.6 [U] ADR-0003 SHALL record 配置の相違と採用理由: 継承 spec は `apps/agent-api`、本 spec は
**`services/api`**。理由は既存 `services/agent` との対称性（`services/` = 非 Node ランタイムの
サイドカー群）であり、`apps/` は pnpm workspace メンバー（Node）に予約する。

### Requirement 5: ガイド背骨（Phase 1・コード移動ゼロ）

**User Story**: 学習者として、8 手法の一次情報から書籍 14 章までが 1 本の学習パスで
辿れてほしい。理由: 本番指向 2 repo は 6 パターンを参照できる場所を持たず、学習指向 2 repo は
本番規律を持たない（正本レビュー X-16）。

**Acceptance Criteria**:

5.1 [E] WHEN `docs/guide/` が構築される時, THE VAZ platform SHALL use
`docs/agentic-engineering-review.md` の 8 手法（PE / CE / LE / HE / AE / AO / MCP / EV）を骨格とし、
各手法から (a) ハブ内の実装、(b) 兄弟 repo の教材、(c) 正本レビューの X-n 項目 への
リンクを SHALL provide。
5.2 [U] `docs/guide/` SHALL NOT duplicate 既存文書の本文。リンクと 1〜3 文の導入のみとする
（憲章原則 5「既存の単一経路に合流させる」）。
5.3 [U] 書籍原稿 14 章（`pydantic-ai-agentic-patterns/docs/part{1..5}/ch{01..14}.md`）は
Phase 1 時点では**リンク参照のみ**。実体の移設は Phase 3（R7）の裁定に従う。
5.4 [U] Phase 1 SHALL NOT move any code、and SHALL NOT change any CI gate。

### Requirement 6: 第 2 Python レーン `services/api`（Phase 2）

**User Story**: 保守者として、`fastapi-pydantic-ai-agent`（43,592 LOC）を既存の
`services/agent` と**同じ型**の独立レーンとして迎えたい。理由: 統合計画 §4.2 のとおり
polyglot レーン分離は既に設計・文書化されており、第 2 レーン追加は低コストで済む。

**Acceptance Criteria**:

6.1 [U] `services/api` SHALL own 独自の `pyproject.toml` ＋ `uv.lock`。ルート
`pyproject.toml` / `uv.lock` SHALL NOT be created（統合計画 §4.2 / ADR-0003）。
6.2 [E] WHEN レーンが追加される時, THE VAZ platform SHALL add `mise.toml` task
**`api:check`**（`dir = "services/api"`）を `py:check` と同型で定義し、
**`check` の依存には SHALL NOT add**（NFR-1 のスタンス維持: TS ゲートは Python ツールチェーン
不在でも green であること）。
6.3 [E] WHEN CI が追加される時, THE VAZ platform SHALL add a **path-filtered** workflow
（`services/api/**` / `mise.toml` / 自身）and SHALL NOT include it in `tests.yml` の `gate` 集約
（path-filtered job は多くの push で不在になり `needs` + `if: always()` の required check を壊すため。
`python.yml` と同一の理由・同一の型）。
6.4 [E] WHEN `services/api` が配置された時, `mise run lint:model-ids` SHALL remain green。
実測（ハブのゲート正規表現
`claude-[a-z0-9]|llama-?[0-9]|gpt-[0-9]|gemini-[0-9]|qwen[0-9]|mistral-[a-z0-9]` を
取り込み対象へ適用）で検出される **3 箇所**は下表のとおり、いずれも **docstring / コメント内の
書式例**であり代入ではない:

| 行 | 内容 |
|---|---|
| `services/api/app/agents/chat_agent.py:39` | `format (e.g. "openai:gpt-4o" → "openai/gpt-4o", ...)` |
| `services/api/app/config/settings.py:40` | `(e.g., "openai:gpt-4o", "anthropic:claude-3-5-sonnet-20241022")` |
| `services/api/app/config/settings.py:63` | `"openai:gpt-4o"` |

解決は**優先順位つきで 3 案**、既定は (c):
(a) `scripts/forbid-model-ids.sh` の carve-out に 2 ファイルを追加 — 最小だが carve-out が増える。
(b) 3 箇所の docstring を書式例から実値を除いた表現へ改める — 移植元の文書品質を下げる。
(c) **ハブのゲートを「代入形」検出へ精密化する**（移植元 `tests/unit/test_no_hardcoded_model_ids.py`
の `_PATTERN` が既に代入形を検出している）。ゲートが**より正確**になり carve-out が増えない。
6.5 [U] WHERE (c) を採る場合, THE VAZ platform SHALL keep **両ガードを併存**させる
（ハブの shell grep ＋ `services/api` 自身の pytest ＋ pre-commit pygrep）and SHALL add
carve-out リストの**ドリフト検出テスト**（2 つのガードが異なる carve-out を持つと静かに乖離するため）。
6.6 [U] 移植元の**リポジトリガード 17 件**（`CLAUDE.md` "Repo guards" 節が列挙）SHALL be carried over
intact。特に `test_ci_workflows.py`（全 `uses:` の 40 桁 SHA 固定検証）は正本レビュー X-1 の owner であり、
**走査したワークフローファイル数 > 0 のアサート**を SHALL include（X-1 の「移植時の必須追加」。
対象が存在しないガードは常に緑になる）。
6.7 [U] 移植元の **load-bearing な依存上限**（`fastapi<0.137` / `starlette<1.0` /
`pydantic-ai-litellm<0.3.0`）SHALL be preserved with その理由コメント。`services/agent`
（`fastapi>=0.141.1`）との同居は独立レーンゆえ成立する（両者 `requires-python = ">=3.13"`）。
6.8 [U] `AGENTS.md` / `CLAUDE.md` は**ペア編集**（移植元 Req 8.2 とハブの既存規約が一致）。
`services/api` 固有の規約は `services/api/CLAUDE.md` に残し、ハブのルート `CLAUDE.md` からは
**参照のみ**とする（本文重複は禁止 — 5.2 と同じ理由）。

### Requirement 7: パターンカタログの取捨選択（Phase 3）

**User Story**: 学習者として、6 パターンの正本が 1 つに定まっていてほしい。
理由: `pydantic-ai-sandbox` と `pydantic-ai-agentic-patterns` が**純粋な重複**を持つ
（統合計画 §4.3。補完ではない）。

**Acceptance Criteria**:

7.1 [U] `pydantic-ai-sandbox` の **3 FW 横断比較は取り込まない**。8 レーン独立 uv 構成が
成立要件であり、崩してまで持ち込む価値が薄い（統合計画 §6.3）。upstream 維持 ＋ ガイドからリンク。
7.2 [U] 教材用の単純版（`pydantic-ai-agentic-patterns/src/part3_workflows/` ほか）を
ガイドの正本とし、比較版は sandbox へリンクする。
7.3 [E] WHEN 教材コードがハブへ移設される時, `lint:model-ids` SHALL remain green。
実測で **2 箇所**が検出され、こちらは **docstring ではなく実際の代入**である:

| 行 | 内容 |
|---|---|
| `src/part1_foundations/prompt_caching.py:30` | `agent = Agent("claude-sonnet-5")` |
| `src/common/settings.py:37` | `default_model: str = Field(default="claude-sonnet-5", ...)` |

R6.4 の (c)（代入形検出への精密化）を採った場合、この 2 箇所は**依然として検出される**。
移設時に `@vaz/config` 相当の allowlist へ寄せることを SHALL require。
7.4 [U] 移設対象は**選択的**とし、`specs/review/`（点時記録）は SHALL NOT be moved（R9.2）。

### Requirement 8: 真のギャップの充填（Phase 4）

**User Story**: 保守者として、2026 年時点で実装ゼロの層を識別・充填したい。
理由: 統合計画 §5.2 が Agent Skills / A2A を「**調査した 4 repo すべてで 0 件。真のギャップ**」と
実測している。

**Acceptance Criteria**:

8.1 [O] WHERE Agent Skills（`SKILL.md` ＋ `references/`）を採用する場合,
THE VAZ platform SHALL record 採用判断を ADR として（MCP ADR-0001 と同じ型: 採用トリガ条件つき）。
8.2 [O] WHERE A2A を採用する場合, 同上。
8.3 [E] WHEN Phase 2 が完了した時（＝ TS 4 値と Python 5 値が 1 リポジトリに同居した時）,
THE VAZ platform SHALL author **`docs/adr/0004-stop-reason-vocabulary.md`**。
正本レビュー X-5 の写像表を出発点とし、下表の非対称（Python 5 値は「なぜ止まったか」が監査ログ
単独で完結、TS 4 値は `error` の内訳を別経路と突き合わせる必要がある）を裁定する:

| Python 5 値 | TS 4 値（実測 `packages/schemas/src/run-metrics.ts:16`） |
|---|---|
| `completed` | `natural` |
| `max_iterations` | `step-cap` |
| `budget_exceeded` | `budget-exceeded` |
| `denied` | — （承認拒否は `ApprovalDeniedError` 経路） |
| `disallowed_tool` | — （allow-list 違反は例外経路） |
| — | `error` |

8.4 [U] ADR-0004 SHALL NOT 語彙を強制統一 without 後方互換の評価。TS 4 値は SSE 契約（`JobEvent`）と
`audit_log` テーブルに既に出ている（X-5 が統一を見送った理由）。
8.5 [O] WHERE `pydantic-ai-agentic-patterns` の未解決 High `I-H10`（停止理由が語彙化されておらず
トークン予算による停止も無い）を解消する場合, 移植元は `services/api` の閉じた `StopReason` 語彙
＋ **副作用前**トークン予算とする（統合計画 §3.4 の「移植機会」）。

### Requirement 9: 参照整合と旧リポジトリの整理（Phase 5）

**User Story**: 5 repo の読者として、リネーム後も相互参照が壊れていないでほしい。

**Acceptance Criteria**:

9.1 [E] WHEN リネームが完了した時, THE VAZ platform SHALL provide 検証スクリプト that asserts:
(a) `cross-repo-adoption-review` への 7 参照がすべて解決する、(b) 走査した参照数 > 0
（**非空アサート** — 正本レビュー X-3 の共通原則）。
9.2 [U] `pydantic-ai-agentic-patterns/specs/review/vaz-ai-next/` SHALL NOT be renamed。
代わりに `specs/review/INDEX.md` へ 1 行の注記（「本ディレクトリは当時 `vaz-ai-next` という名の
リポジトリに対するレビュー。現 `vaz-agentic-ai-next`」）を SHALL add。
9.3 [U] `beeai-agentic-ai-sandbox` への取り込み（正本レビュー §5 の X-4 最優先ほか）は
本 spec の境界外とし、`pdca/act.md` へ SHALL be 申し送り。
9.4 [O] WHERE 旧リポジトリをアーカイブする場合, `fastapi-pydantic-ai-agent` /
`pydantic-ai-sandbox` / `pydantic-ai-agentic-patterns` の扱いは Phase 2・3 の**着地後**に決める。
Phase 2 未完了の時点でのアーカイブは SHALL NOT be permitted。

### 非機能要件（NFR）

NFR-1 [U] **段階独立着地**: Phase 0〜1（R1〜R5）はコード移動ゼロであり、Phase 2 以降の
未決定を待たずに着地可能でなければならない。
NFR-2 [U] **ゲート維持**: 各 Phase の着地時点で `mise run check`（`lint` / `typecheck` /
`test:run` / `audit` / `lint:model-ids`）が green であること。`py:check` / `api:check` は
`check` の依存に加えない。
NFR-3 [U] **追記のみ**: 点時記録（正本レビュー本文・`specs/review/**`・既存 spec の pdca）は
改変せず、日付付き addendum で更新する。
NFR-4 [U] **非空アサート**: 本 spec が追加するすべてのゲート・検証スクリプトは
「走査対象数 > 0」を含むこと（正本レビュー X-3）。
NFR-5 [U] **不可逆操作の保護**: リポジトリ削除は R1.3 の検証 green ＋ ユーザの明示選択の
両方を前提とする。
NFR-6 [U] **憲章原則 8 の適用**: 本 spec 内の主張が実測と食い違った場合、実測で置き換える。
