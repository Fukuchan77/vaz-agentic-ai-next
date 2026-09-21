# 006-repo-consolidation — Implementation Tasks

`plan.md` に準拠。散文は日本語、識別子・型・パス・コードは英語。

規約（002/003/004/005 と同一）:

- `- [ ]` 未着手 / `- [x]` 完了 / `- [ ]*` 任意・後回し可。
- `(P)` = 並列実行安全（依存なし・境界が互いに素）。
- 全タスクは `_Boundary:_` と `_Depends:_` を宣言する。
- `_Requirements:_` は要件 ID のみをカンマ区切りで列挙する。
- **`_Boundary:_` には周辺必須ファイル（テスト・lockfile・doc の該当節）を先回りで含める**。
- **不可逆操作を含むタスク（Task 2）は、前提条件の検証 green を `_Gate:_` として宣言する。**

## Task 依存図

```
Task 1（退避 R1）
   └─→ Task 2（同一性移行 R2・不可逆）── Gate: Task 1 の 9 ファイル検証 green
          ├─→ Task 3（正本設置 R3）      ← rename 後に実行すると参照が編集ゼロで解決
          │      └─→ Task 4（憲章・継承 spec・ADR-0003  R4）
          ├─→ Task 8.1（参照検証 R9.1）  ← rename 直後に実行
          └─→ Task 5（ガイド背骨 R5）(P)
                 └─→ Task 6（services/api R6）
                        ├─→ Task 7（patterns R7）
                        └─→ Task 8.3（ADR-0004 R8.3）← TS/Python 語彙の同居が成立した時点
```

NFR-1: Task 1〜5 はコード移動ゼロ。Task 6 以降の未決定を待たずに着地可能。

---

## 1. 継承資産の退避（P0・不可逆操作の前提）

_Boundary:_ `specs/006-repo-consolidation/pdca/do.md`（退避記録の節）, ハブの
`archive/vaz-agentic-ai-next` ブランチ（新規 ref）
_Depends:_ none
_Requirements:_ 1.1, 1.2, 1.3, 1.4, 1.5, NFR-5

- [ ] `Fukuchan77/vaz-agentic-ai-next` の全 ref を列挙し、**6 本の非 main ブランチ**の tip SHA を
      `pdca/do.md` に記録する（`git ls-remote --heads origin`）。
- [ ] `claude/agentic-ai-repo-design-3k8e32`（正本レビューと憲章の両方を含む最大集合）を
      `--depth 50` で fetch する。
- [ ] 残り 5 ブランチについて、`claude/agentic-ai-repo-design-3k8e32` の**部分集合であるか**を
      `git diff --stat` で判定する。部分集合でないものは個別に fetch する（R1.5）。
- [ ] 退避 ref をハブへ push する: `git push origin <sha>:refs/heads/archive/vaz-agentic-ai-next`。
      **ファイルコピーではなく ref の push**とする（履歴と作成者情報の保全 — R1.2）。
- [ ] **検証（R1.3）**: 9 ファイルの行数が下表と一致することを確認し、結果を `pdca/do.md` に記録する。
      1 件でも不一致なら Task 2 に進まない。

      | path | 期待行数 |
      |---|---:|
      | `docs/cross-repo-adoption-review.md` | 493 |
      | `specs/001-agentic-ai-core-p0/spec-agenticai-core.md` | 1806 |
      | `specs/001-agentic-ai-core-p0/plan.md` | 1338 |
      | `specs/001-agentic-ai-core-p0/tasks.md` | 662 |
      | `specs/001-agentic-ai-core-p0/research.md` | 330 |
      | `specs/001-agentic-ai-core-p0/traceability.md` | 100 |
      | `specs/memory/constitution.md` | 296 |
      | `CLAUDE.md` | 241 |
      | `AGENTS.md` | 141 |

- [ ] 正本レビューが**ユーザ添付ファイルと byte 一致**することを `diff` で再確認する
      （出所の同一性証明。既に 2026-09-21 に確認済みだが退避後の ref に対して再実行する）。

## 2. 同一性の移行（不可逆操作を含む）

_Gate:_ **Task 1 の 9 ファイル検証が green であること。** 未 green での着手は禁止（NFR-5）。
_Boundary:_ `package.json`, `apps/web/src/app/layout.tsx`, `apps/web/src/features/chat/Chat.tsx`,
`apps/web/tests/e2e/home.spec.ts`, `apps/web/tests/e2e/a11y.spec.ts`, `README.md`,
GitHub 上の 2 リポジトリ名
_Depends:_ Task 1
_Requirements:_ 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, NFR-5

- [ ] **名前空け（既定）**: `Fukuchan77/vaz-agentic-ai-next` → `vaz-agentic-ai-next-archive` へ
      リネームする。可逆であり全ブランチが保全される（plan §2.2）。
- [ ]* **名前空け（代替）**: ユーザが Task 1 の検証結果を確認したうえで**明示的に削除を選択した
      場合のみ**、削除する（R2.2）。既定ではない。
- [ ] `Fukuchan77/vaz-ai-next` → `Fukuchan77/vaz-agentic-ai-next` へリネームする。
      **可視性は public (MIT) のまま変更しない**（R2.3）。
- [ ] ローカルクローンの remote URL を更新する（`git remote set-url origin ...`）。
- [ ] **6 ファイルを 1 コミットで**更新する（R2.5 / plan §2.6 — 分割すると pre-push の
      Playwright が赤になる）:
  - [ ] `package.json:2` — `"name": "vaz-agentic-ai-next"`
  - [ ] `apps/web/src/app/layout.tsx:6` — `title: "vaz-agentic-ai-next"`
  - [ ] `apps/web/src/features/chat/Chat.tsx:124` — `<h1>` テキスト
  - [ ] `apps/web/tests/e2e/home.spec.ts:6` — `getByRole("heading", { name: ... })`
  - [ ] `apps/web/tests/e2e/a11y.spec.ts:18` — 同上
  - [ ] `README.md:1` — 表題
- [ ] `@vaz/*` の 9 パッケージ名が**変更されていない**ことを確認する（R2.6）:
      `pnpm ls -r --depth -1` が 9 メンバーを列挙すること。
- [ ] `specs/00{1,3,5}-*/` 配下の `vaz-ai-next` 言及 9 箇所を**書き換えていない**ことを確認する（R2.7）。
- [ ] `mise run check` と `mise run test:e2e` が green であることを確認する（NFR-2）。

## 3. 正本 `cross-repo-adoption-review.md` の設置

_Boundary:_ `docs/cross-repo-adoption-review.md`（新規）, `specs/006-repo-consolidation/pdca/do.md`
_Depends:_ Task 2（rename 後に置くことで 7 参照が編集ゼロで解決する — spec.md 前提誤り 2）
_Requirements:_ 3.1, 3.2, 3.3, 3.4, 3.5, NFR-3

- [ ] `archive/vaz-agentic-ai-next` から `docs/cross-repo-adoption-review.md` を
      **verbatim（493 行・本文改変なし）**で配置する。出所 SHA を `pdca/do.md` に記録する。
- [ ] 本文末尾に `## §6 追記（2026-09-21）— 同一性の崩壊と再実測` を追加する（R3.2）:
  - [ ] **同一性の崩壊**: §1 の `vaz-ai-next` 列（実装・CI・依存の実測値）と
        `vaz-agentic-ai-next` 列（憲章・P0 spec・REQ-7.5/7.6）が 1 本に畳まれた旨を写像表で記す。
  - [ ] **再実測で stale となった行**（R3.3）: `Actions SHA 固定 0/22 → 28/28`、
        `workflow permissions: 0/6 → 6/6`。X-1 は着地済み。**本文セルは書き換えない**。
  - [ ] **スコープ**: 本セッションに attach されたのは 4 repo ＋ ハブであり、
        `beeai-agentic-ai-sandbox` は未検証（R9.3 へ申し送り）。
- [ ] `docs/README.md` 相当の索引がある場合、正本への 1 行を追加する。

## 4. 憲章・継承 spec の受け入れと ADR-0003

_Boundary:_ `specs/memory/constitution.md`（新規）,
`specs/inherited/001-agentic-ai-core-p0/**`（新規 8 ファイル）,
`docs/adr/0003-consolidation-direction.md`（新規）, `CLAUDE.md`, `AGENTS.md`（ペア編集）
_Depends:_ Task 3
_Requirements:_ 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, NFR-3

- [ ] `specs/memory/constitution.md`（296 行・11 原則・v1.2.0）を verbatim 配置する（R4.1）。
      継承 spec の `spec.json.constitution.path` と同一パスのため参照が自動解決する。
- [ ] 継承 spec 一式を **`specs/inherited/001-agentic-ai-core-p0/`** へ配置する（R4.2）。
      ハブの `001-vaz-ai-update` との採番衝突を避けるため、`specs/` 直下には置かない。
- [ ] `docs/adr/0003-consolidation-direction.md` を起草する:
  - [ ] **決定**: `vaz-ai-next` をリネームして昇格。ルート `pyproject.toml` / `turbo.json` は作らない。
        Python レーンは `services/api`（`apps/agent-api` ではない — R4.6）。
  - [ ] **supersede 対象を明示列挙**（R4.4）: 継承 spec の `T-0` / `T-1.2` / `T-1.3` / `T-2`。
        **53 要件は supersede しない**（R4.3）。
  - [ ] **両文書が独立に同じ結論へ到達した事実を記録**（R4.5）: 継承 spec の ADR-P0-05 候補 (a)
        （uv workspace メンバーに含めない・独自 lock・mise 直接実行）と統合計画 §4.2 は同方向。
        本 spec はその極限形。
  - [ ] **Turborepo を採らない根拠**: Python 対応は 2.10.13 で `FutureFlags` 下の experimental
        （統合計画 §5.1）。継承 spec §12 R14 も「uv workspace メンバー選定は Turborepo 採否と
        同一の決定」と述べる。
- [ ] `CLAUDE.md` / `AGENTS.md` を**ペアで**更新し、憲章・継承 spec・ADR-0003 への参照を追加する。
      本文の重複は避け、参照のみとする。

## 5. ガイド背骨 `docs/guide/`（Phase 1・コード移動ゼロ）(P)

_Boundary:_ `docs/guide/**`（新規）, `docs/agentic-engineering-review.md`（リンク追記のみ）,
`CLAUDE.md`, `AGENTS.md`（ペア編集）
_Depends:_ Task 2
_Requirements:_ 5.1, 5.2, 5.3, 5.4, NFR-1

- [ ] 8 手法（PE / CE / LE / HE / AE / AO / MCP / EV）を骨格に `docs/guide/` の目次を作る。
- [ ] 各手法から (a) ハブ内実装 (b) 兄弟 repo の教材 (c) 正本レビューの X-n へリンクする。
- [ ] **本文を複製しない**（R5.2 / 憲章原則 5）。リンクと 1〜3 文の導入に留める。
- [ ] 書籍原稿 14 章はリンク参照のみとし、実体移設は Task 7 の裁定に従う（R5.3）。
- [ ] `mise run check` が green であることを確認する（コード・CI に触れていないこと）。

## 6. 第 2 Python レーン `services/api`（Phase 2）

_Boundary:_ `services/api/**`（新規）, `mise.toml`（`api:check` / `api:audit` の節）,
`.github/workflows/api.yml`（新規）, `scripts/forbid-model-ids.sh`,
`services/api/CLAUDE.md`, ルート `CLAUDE.md` / `AGENTS.md`（ペア編集）,
carve-out ドリフト検出テスト（新規）
_Depends:_ Task 5
_Requirements:_ 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, NFR-1, NFR-2, NFR-4

- [ ] `fastapi-pydantic-ai-agent` を `services/api/` として配置する。**独自の `pyproject.toml` ＋
      `uv.lock` を保持**し、ルート `pyproject.toml` / `uv.lock` は作らない（R6.1）。
- [ ] `mise.toml` に `api:check`（`dir = "services/api"`）を `py:check` と同型で追加する。
      **`check` の依存には加えない**（R6.2 / NFR-1）。
- [ ] `.github/workflows/api.yml` を **path-filtered** で追加する（`services/api/**` / `mise.toml` /
      自身）。`permissions: contents: read` 宣言、全 `uses:` を 40 桁 SHA 固定（既存 6/6・28/28 の
      規律を維持）。**`tests.yml` の `gate` 集約には含めない**（R6.3）。
- [ ] **model-ID ゲートの解決**（R6.4）。既定は案 (c):
  - [ ] `scripts/forbid-model-ids.sh` を**代入形検出**へ精密化する（移植元
        `tests/unit/test_no_hardcoded_model_ids.py` の `_PATTERN` を参照）。
  - [ ] 精密化後に実測 3 箇所（`app/agents/chat_agent.py:39`, `app/config/settings.py:40,63`
        — いずれも docstring 内の書式例）が green になることを確認する。
  - [ ] **carve-out ドリフト検出テスト**を追加する（R6.5）。ハブの shell grep と
        `services/api` の pytest guard が異なる carve-out を持つと静かに乖離するため。
- [ ] **リポジトリガード 17 件**を移送する（R6.6）。`test_ci_workflows.py` には
      **走査 workflow 数 > 0 の非空アサート**を追加する（X-1 の必須追加項目 / NFR-4）。
      移送後の走査対象は 6 → 7 workflow。
- [ ] load-bearing な依存上限（`fastapi<0.137` / `starlette<1.0` / `pydantic-ai-litellm<0.3.0`）を
      理由コメントごと保持する（R6.7）。`services/agent`（`fastapi>=0.141.1`）との同居は
      独立レーンゆえ成立する（両者 `requires-python = ">=3.13"`）。
- [ ] `services/api/CLAUDE.md` に固有規約を残し、ルート `CLAUDE.md` からは参照のみとする（R6.8）。
- [ ] `mise run check` green ＋ `mise run api:check` green を確認する（NFR-2）。

## 7. パターンカタログの取捨選択（Phase 3）

_Boundary:_ `docs/guide/**`（リンク更新）, 移設する教材コードの配置先,
`scripts/forbid-model-ids.sh` の carve-out または allowlist
_Depends:_ Task 6
_Requirements:_ 7.1, 7.2, 7.3, 7.4

- [ ] `pydantic-ai-sandbox` の 3 FW 横断比較は**取り込まない**。upstream 維持 ＋ リンク（R7.1）。
- [ ] 教材用の単純版をガイドの正本とし、比較版は sandbox へリンクする（R7.2）。
- [ ] 教材コード移設時の model-ID 2 箇所（`src/part1_foundations/prompt_caching.py:30` の
      `Agent("claude-sonnet-5")`、`src/common/settings.py:37` の `Field(default="claude-sonnet-5")`）を
      allowlist へ寄せる。**これらは docstring ではなく実代入**であり、案 (c) でも検出される（R7.3）。
- [ ] `specs/review/`（点時記録）は移設しない（R7.4 / NFR-3）。

## 8. ギャップ充填・参照整合・旧 repo 整理（Phase 4〜5）

_Boundary:_ `docs/adr/0004-stop-reason-vocabulary.md`（新規）, 参照検証スクリプト（新規）,
`pydantic-ai-agentic-patterns/specs/review/INDEX.md`, `specs/006-repo-consolidation/pdca/act.md`
_Depends:_ 8.1 は Task 2 / 8.3 は Task 6 / 8.4 は Task 6
_Requirements:_ 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, NFR-4

- [ ] **8.1 参照検証（R9.1）** — Task 2 直後に実行。`cross-repo-adoption-review` への 7 参照が
      すべて実在パスへ解決することを機械検証する。**走査参照数 > 0 の非空アサート**を含む（NFR-4）。
- [ ] **8.2**（R9.2）`pydantic-ai-agentic-patterns/specs/review/vaz-ai-next/` は**リネームしない**。
      `specs/review/INDEX.md` に 1 行の注記を追加する。
- [ ] **8.3 ADR-0004（R8.3）** — Task 6 完了時点、すなわち TS 4 値
      （`packages/schemas/src/run-metrics.ts:16` = `natural`/`step-cap`/`budget-exceeded`/`error`）と
      Python 5 値（`completed`/`max_iterations`/`budget_exceeded`/`denied`/`disallowed_tool`）が
      1 リポジトリに同居した時点で起票する。正本レビュー X-5 の写像表を出発点とし、
      **強制統一はしない**（TS 4 値は `JobEvent` SSE 契約と `audit_log` に既出 — R8.4）。
- [ ]* **8.4**（R8.1/8.2）Agent Skills（`SKILL.md`）/ A2A の採用判断。採用する場合は
      ADR-0001（MCP）と同じ型（採用トリガ条件つき）で ADR 化する。
- [ ]* **8.5**（R8.5）`I-H10`（停止理由の語彙化・トークン予算）を `services/api` の閉じた
      `StopReason` 語彙 ＋ 副作用前トークン予算から教材側へ移植する。
- [ ] **8.6**（R9.3）`beeai-agentic-ai-sandbox` への取り込みが本 spec の境界外であることを
      `pdca/act.md` へ申し送る。
- [ ] **8.7**（R9.4）旧リポジトリのアーカイブ判断は Task 6 の着地後に行う。
      **Phase 2 未完了時点でのアーカイブは禁止**。
