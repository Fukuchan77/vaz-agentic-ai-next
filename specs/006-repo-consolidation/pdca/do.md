# 006-repo-consolidation — Do（実行記録）

## Task 1: 継承資産の退避

### 実行日時
2026-09-21（ユーザによる `vaz-agentic-ai-next` → `vaz-agentic-ai-next-archive` リネーム直後）

### 前提: ユーザ操作の確認

ユーザが GitHub 上で `Fukuchan77/vaz-agentic-ai-next` を `Fukuchan77/vaz-agentic-ai-next-archive`
へリネーム済み（`list_repos` で確認: `vaz-ai-next` = public、`vaz-agentic-ai-next-archive` = private）。
**`vaz-ai-next` → `vaz-agentic-ai-next` の rename（Task 2 / R2.3）はこの時点で未実施。**

### R1.1 — 全 6 非 main ブランチの tip SHA 記録

`git ls-remote --heads https://github.com/Fukuchan77/vaz-agentic-ai-next-archive` で再確認
（spec.md 起草時の記録と完全一致）:

| ブランチ | tip SHA |
|---|---|
| `001-agentic-ai-core` | `0a245f731b3a6af9dcc00908167d2c2f4f492ab2` |
| `claude/agentic-ai-app-spec-xo42j1` | `323f3780a931e6301ca5dc078d27b1007f957a15` |
| `claude/agentic-ai-repo-design-3k8e32` | `282d7064d90ba754e12f3a9a7acd912e272a3b83` |
| `claude/attachment-spec-review-2g4d21` | `9f2a650cfd0f6e1b543daa87975be6d67b9b00c6` |
| `claude/sharp-hopper-kbrpfo` | `af47c46839142f7e26234dbeaab3700126732192` |
| `claude/spec-agentic-001-review-jf4dcd` | `50afd8f9208e734d6ef951075daa53a836f8fa37` |
| （参考）`main` | `507161c49c3c0e49e1a1277d03a1a23755d12e71`（3 ファイルのみ。退避対象外） |

### R1.5 — subset 判定（spec の想定より踏み込んだ結果）

`claude/agentic-ai-repo-design-3k8e32`（14 ファイル・正本レビューと憲章を含む最大集合）を基準に
`git merge-base --is-ancestor` と `git ls-tree` パス差分で判定。

| ブランチ | 基準の祖先か | 基準に無いファイル |
|---|---|---|
| `001-agentic-ai-core` | **YES（真の subset）** | なし |
| `claude/agentic-ai-app-spec-xo42j1` | NO | `docs/SPEC-AGENTIC-001.md` |
| `claude/attachment-spec-review-2g4d21` | NO | `docs/SPEC-AGENTIC-001.md` |
| `claude/sharp-hopper-kbrpfo` | NO | `docs/integration-plan.md` |
| `claude/spec-agentic-001-review-jf4dcd` | NO | `docs/REVIEW-VERIFICATION-001.md`, `docs/SPEC-AGENTIC-001.md` |

**spec.md 起草時点の想定（「4 本は部分集合の可能性がある」）は誤りだった。** 実際は
`001-agentic-ai-core` の 1 本のみが真の subset で、残り 4 本はそれぞれ固有ファイルを持つ:

- `docs/integration-plan.md`（`sharp-hopper-kbrpfo`）— ユーザ添付の統合計画の**前版**
  （371 行、5 リポジトリ対象・beeai を「ユーザ指示により保留」と明記。添付版は 365 行・4 リポジトリ対象
  で beeai への言及が整理されている。両者は同一ではない）。
- `docs/SPEC-AGENTIC-001.md` — `specs/001-agentic-ai-core-p0/spec-agenticai-core.md`（v1.7）の
  **前身**。v1.5/v1.6 系列で、改訂履歴 A.1〜A.3 に v1.0〜v1.5 の変更点・撤回された推奨 2 件を記録。
- `docs/REVIEW-VERIFICATION-001.md`（425 行）— `SPEC-AGENTIC-001.md` v1.5 に対する
  Adversarial Review（CRITICAL 3 / HIGH 4 / MEDIUM 5 / LOW 2）の検証報告。v1.6 への訂正の根拠。

→ **結果として 6 本すべてを push した**（`001-agentic-ai-core` は基準ブランチの祖先のため
内容は基準の push で既に含まれるが、ref 自体は独立して記録した）。

### R1.2 — push 実行

ローカルの `vaz-agentic-ai-next-archive` clone から `--depth 50` で 6 ブランチを取得し、
`git push` でハブへ **ref の push**として送付（ファイルコピーではない。履歴・作成者情報を保全）。

```
archive/vaz-agentic-ai-next/001-agentic-ai-core
archive/vaz-agentic-ai-next/claude/agentic-ai-app-spec-xo42j1
archive/vaz-agentic-ai-next/claude/agentic-ai-repo-design-3k8e32
archive/vaz-agentic-ai-next/claude/attachment-spec-review-2g4d21
archive/vaz-agentic-ai-next/claude/sharp-hopper-kbrpfo
archive/vaz-agentic-ai-next/claude/spec-agentic-001-review-jf4dcd
```

push 先 SHA は `git ls-remote origin 'refs/heads/archive/*'` で確認済み。R1.1 の記録と完全一致。

### R1.3 — 9 ファイルの行数検証（**GREEN**）

push 済み ref `archive/vaz-agentic-ai-next/claude/agentic-ai-repo-design-3k8e32` から再読み出し。

| path | 期待 | 実測 | 判定 |
|---|---:|---:|---|
| `docs/cross-repo-adoption-review.md` | 493 | 493 | OK |
| `specs/001-agentic-ai-core-p0/spec-agenticai-core.md` | 1806 | 1806 | OK |
| `specs/001-agentic-ai-core-p0/plan.md` | 1338 | 1338 | OK |
| `specs/001-agentic-ai-core-p0/tasks.md` | 662 | 662 | OK |
| `specs/001-agentic-ai-core-p0/research.md` | 330 | 330 | OK |
| `specs/001-agentic-ai-core-p0/traceability.md` | 100 | 100 | OK |
| `specs/memory/constitution.md` | 296 | 296 | OK |
| `CLAUDE.md` | 241 | 241 | OK |
| `AGENTS.md` | 141 | 141 | OK |

**9 / 9 GREEN。** `docs/cross-repo-adoption-review.md` は push 済み ref から再取得しても
ユーザ添付ファイルと byte-identical（`diff` 再実行済み）。

### 検証済み: Task 2（不可逆操作）の Gate は解除可

R1.3 が 9/9 GREEN であるため、`plan.md` の Gate（「Task 1 の 9 ファイル検証が green であること」）
は満たされた。Task 2 に進んでよい。

---

## 運用上の重要な発見（次セッションへの申し送り）

### GitHub のリネームリダイレクトは「旧名 → 新名」の**片方向**であり、名前の競合期間中は罠になる

Task 1 の途中、ハブのローカル clone の origin URL を先回りして
`https://github.com/Fukuchan77/vaz-agentic-ai-next`（Task 2 でハブに付与予定の**未来の**名前）へ
変更し `git fetch` したところ、**アーカイブ側リポジトリの内容が返ってきた**（`main` が
`6e6a558`→`507161c` へ "forced update"）。

**原因**: そのリポジトリ（現 `vaz-agentic-ai-next-archive`）は直前まで `vaz-agentic-ai-next` という
名前だった。GitHub は旧名からのリクエストを新しい場所へ自動リダイレクトするため、
まだ誰も名乗っていない `vaz-agentic-ai-next` という URL は**アーカイブ側の旧名リダイレクトが
横取りする形で応答した**。ハブ（`vaz-ai-next`）はこの時点でまだリネームされていない。

**実害はゼロ**（`git fetch` はローカルの remote-tracking ref を書き換えるのみで、作業ブランチ・
リモート実体のいずれも変更しない）。直後に origin を実名 `vaz-ai-next` へ戻し `fetch` して復旧した。

**教訓（Task 2 着手時に厳守）**:
1. **同一セッション内でリネームの旧名・新名を同時に URL として使わない。** 名前の競合ウィンドウ
   （旧リポジトリの自動リダイレクトが有効な間、新リポジトリがまだその名前を名乗っていない期間）では
   同じ文字列が指す実体が変わる。
2. Task 2 で `vaz-ai-next` → `vaz-agentic-ai-next` を rename した**直後**は、必ず
   `git ls-remote https://github.com/Fukuchan77/vaz-agentic-ai-next` を実行し、
   **返る SHA がハブの想定 tip と一致することを rename 直後に確認**してから他の操作に進む
   （spec.md の R9.1 検証スクリプトへこの確認を追加する）。
3. GitHub 側の add_repo/セッションの repo alias は「呼び出し時に指定した owner/repo 文字列」で
   キャッシュされる場合があるため、rename 後は該当 repo を明示的に再 add_repo し、
   ローカル clone の `origin` URL も rename 後の正式名へ張り替えてから `fetch` で疎通確認する。

---

## Task 2: 同一性の移行

### 実行日時
2026-09-21（ユーザによる `vaz-ai-next` → `vaz-agentic-ai-next` リネーム直後）

### リネーム後の疎通確認（pdca/do.md の教訓を適用）

Task 1 のヒヤリハットを踏まえ、リネーム完了の報告後もローカル clone の origin を書き換える前に
`list_repos` で GitHub 側の実際の状態を確認した:

```
Fukuchan77/vaz-agentic-ai-next          public   pushed_at: 2026-09-21T09:16:05Z
Fukuchan77/vaz-agentic-ai-next-archive  private  pushed_at: 2026-09-21T08:18:23Z
```

`git remote set-url origin https://github.com/Fukuchan77/vaz-agentic-ai-next` の後、
**信用する前に** `git ls-remote origin HEAD` を実行し、返る SHA（`6e6a558...`）が
ハブの既知の `main` tip と一致することを確認した（アーカイブの `507161c` ではないこと）。
続けて `git fetch origin claude/busy-hopper-5psrh2` を実行し、ローカル HEAD と完全一致、
かつ Task 1 で push した `archive/vaz-agentic-ai-next/*` 6 refs が新名の下でも健在であることを
確認してから作業を継続した。

### R2.3〜R2.8 — 6 ファイルの更新

1 コミットで以下を更新（分割すると pre-push の Playwright E2E が赤になるため — R2.5）:

| ファイル | 変更 |
|---|---|
| `package.json:2` | `"vaz-ai-next"` → `"vaz-agentic-ai-next"` |
| `apps/web/src/app/layout.tsx:6` | `title: "vaz-ai-next"` → `"vaz-agentic-ai-next"` |
| `apps/web/src/features/chat/Chat.tsx:124` | `<h1>` テキスト同様 |
| `apps/web/tests/e2e/home.spec.ts:6` | `getByRole` のアサート文字列同様 |
| `apps/web/tests/e2e/a11y.spec.ts:18` | 同上 |
| `README.md:1` | `VAZ-AI-Next` → `VAZ-Agentic-AI-Next` |

`@vaz/*` 9 パッケージ名・`specs/00{1,3,5}-*/` の点時記録 9 箇所は未変更（`grep` で確認 — R2.6/R2.7）。

### NFR-2 検証結果

`mise` がこの実行環境に未導入のため、`AGENTS.md` の pnpm 直接実行版を使用（`pnpm install
--frozen-lockfile` で依存を導入したうえで実行）:

| ゲート | コマンド | 結果 |
|---|---|---|
| lint | `pnpm exec biome check .` | ✅ 157 files, no fixes needed |
| typecheck | `pnpm run typecheck`（= `pnpm -r run typecheck`） | ✅ 9 workspace projects すべて green |
| test:run | `pnpm exec vitest run` | ✅ 62 files / 648 passed, 1 skipped, 0 failed |
| audit | `pnpm audit --audit-level=moderate` | ✅ No known vulnerabilities found |
| lint:model-ids | `bash scripts/forbid-model-ids.sh` | ✅ green |

**E2E（`mise run test:e2e` 相当）は Playwright ランナー自体を実行できなかった。**
このサンドボックスに事前導入されているブラウザは `chromium-1194` だが、リポジトリの
`@playwright/test`（1.63.0）は `chromium_headless_shell-1243` を要求し、バージョンが
食い違う。`git stash` で**変更前の内容**に対して同じコマンドを実行しても同一のエラーが
再現することを確認済みであり、**本 Task の変更が原因ではなく、サンドボックス環境の
事前導入ブラウザとリポジトリのピン版のずれによる、既存の制約**である。

代替として、Playwright が内部で起動するのと同じ `pnpm --filter @vaz/web exec next dev
--port 3000` を直接起動し、稼働中のページを `curl` で直接検証した:

```
<title>vaz-agentic-ai-next</title>
<h1 class="...">vaz-agentic-ai-next</h1>
```

更新後の 2 E2E spec のアサート文字列（`getByRole("heading", { name: "vaz-agentic-ai-next" })`）と
完全一致。E2E ランナーそのものは通せなかったが、**その E2E が検証しようとしている対象
（レンダリングされた見出し文字列）は実サーバーに対して直接確認済み**。

### Task 2 完了。Task 3（正本設置）の前提が整った

R3.4 の「7 参照が編集ゼロで解決する」検証（R9.1）を次に実行できる状態。

---

## Task 3: 正本 `cross-repo-adoption-review.md` の設置

### 実行日時
2026-09-21（Task 2 完了直後。本体の verbatim 配置と §6 addendum は先行コミット `b3a334f` で
実施済みだったため、本タスクでは配置内容の再検証と R9.1（参照解決）を実行した）

### R3.1 — verbatim 配置の再検証

`archive/vaz-agentic-ai-next/claude/agentic-ai-repo-design-3k8e32`（出所 SHA
`282d7064d90ba754e12f3a9a7acd912e272a3b83`）から取得した本文と、ハブの
`docs/cross-repo-adoption-review.md` の先頭 493 行を `diff` で突合。**完全一致（改変なし）**。

### R3.2/R3.3 — §6 addendum の存在確認

`docs/cross-repo-adoption-review.md:497` に `## §6 追記（2026-09-21）— 同一性の崩壊と再実測`
が存在。同一性の崩壊（`vaz-ai-next`/`vaz-agentic-ai-next` 列の統合）、stale 行（X-1: 0/22→28/28、
0/6→6/6）、beeai スコープ外の申し送りをいずれも含む。

### 索引ファイル

`docs/README.md` 相当の索引はハブに存在しない（`ls docs/README.md` → No such file）。
該当作業なし。

### R9.1（先取り実行）— 参照解決の非空検証

Task 2 完了・リネーム後の状態で実行:

```bash
grep -rln "cross-repo-adoption-review" fastapi-pydantic-ai-agent pydantic-ai-sandbox vaz-ai-next \
  --include='*.md' | grep -v 'vaz-ai-next/docs/cross-repo-adoption-review.md' \
                    | grep -v 'vaz-ai-next/specs/006-repo-consolidation'
```

**7 ファイルがヒット（非空 — NFR-4 満たす）**:

```
fastapi-pydantic-ai-agent/CLAUDE.md
fastapi-pydantic-ai-agent/AGENTS.md
fastapi-pydantic-ai-agent/docs/cross-repo-adoption-backlog.md
pydantic-ai-sandbox/docs/README.md
pydantic-ai-sandbox/docs/cross-repo-adoption-backlog.md
vaz-ai-next/docs/cross-repo-adoption-backlog.md
vaz-ai-next/docs/context-budget.md
```

全 7 件が文字列 `vaz-agentic-ai-next/docs/cross-repo-adoption-review.md` を参照しており、
リネーム後のハブに同名で正本が実在することを確認。**7 / 7 が編集ゼロで解決した**
（spec.md 前提誤り 2 のとおり、Phase 0 の「張り替え」作業は不要だった）。

**Task 3 完了。**

---

## Task 4: 憲章・継承 spec の受け入れと ADR-0003

### 実行日時
2026-09-21（Task 3 完了直後）

### R4.1 — 憲章の verbatim 配置

`archive/vaz-agentic-ai-next/claude/agentic-ai-repo-design-3k8e32`（出所 SHA
`282d7064d90ba754e12f3a9a7acd912e272a3b83`）から `specs/memory/constitution.md`（296 行・
11 原則・v1.2.0）を verbatim 配置。行数一致を確認済み（R1.3 で既に検証済み）。

### R4.2 — 継承 spec の配置先

`specs/001-agentic-ai-core-p0/` 配下の実在 7 ファイル（`spec.md` / `spec.json` /
`spec-agenticai-core.md` / `plan.md` / `research.md` / `tasks.md` / `traceability.md`）を
`specs/inherited/001-agentic-ai-core-p0/` へ配置した。

**tasks.md 起草時の「8 ファイル」という見積もりは誤りだった**（実在するのは 7 ファイル。
`git ls-tree` で確認）。tasks.md の記述と食い違うが、実体を優先する（憲章原則 8）。

**発見**: `spec.md`（継承 spec の要件仕様、446 行）はヘッダに「`approvals.tasks` は未承認」と
記すが、`spec.json` の `approvals` フィールドは 3 種すべて `approved: true`。継承元の記録上の
揺れであり、構造化データ（`spec.json`）を優先する判断を ADR-0003 の Consequences に記録した。

### R4.4〜R4.6 — ADR-0003 の起草

`docs/adr/0003-consolidation-direction.md` を作成（ADR-0001/0002 と同一の Status/Date/
仕様根拠ヘッダ + Context/Decision/Consequences/Re-trigger Conditions/References 構成）。

- **supersede 対象を明示列挙**（R4.4）: 継承 spec の `T-0` / `T-1.2` / `T-1.3` / `T-2` の 4 タスク。
  53 要件は supersede しない（R4.3）ことを明記。
- **両文書が独立に同じ結論へ到達した事実**（R4.5）: 継承 spec の ADR-P0-05 候補 (a) と
  統合計画 §4.2 の対比表を記載。
- **Turborepo を採らない根拠 / Python レーンは `services/api`**（R4.6）: `apps/agent-api` ではなく
  `services/api` を採る理由（`apps/` は pnpm workspace メンバーに予約済み、`services/agent` との
  対称性）を明記。

### R4.7（CLAUDE.md / AGENTS.md ペア編集）

- `CLAUDE.md`: 既存の "Governance docs:" 段落の直後に、統合ハブとしての位置づけ・正本レビュー・
  憲章・継承 spec への 1 段落（参照のみ、本文非複製）を追加。
- `AGENTS.md`: "Python sidecar" セクションと "Non-Obvious Patterns" セクションの間に
  新規 "## Repository identity and consolidation" セクションを追加。同じ参照を、
  AGENTS.md の詳細度に合わせてやや厚く記載（ただし正本文書の本文は複製していない）。

### 予期しなかった副作用: biome フォーマッタ

`specs/inherited/001-agentic-ai-core-p0/spec.json` は継承元が 2-space インデントで書いており、
ハブの `biome.json`（`indentStyle: "tab"`、`includes: ["**", ...]` で `specs/**` も対象）と
衝突し `lint` ゲートが赤になった。

**対応**: `pnpm exec biome check --write` で該当 1 ファイルのみ再フォーマット。適用前後で
`JSON.parse` の結果が意味的に完全一致することを Node で検証済み（空白のみの変更、内容変更なし）。
この扱いは spec.md の verbatim 要件（R4.1 は `constitution.md` のみ、R3.1 は正本レビューのみを
対象としており、継承 spec の個別ファイルには verbatim 要求がない）と矛盾しない。

### NFR-2 検証結果（Task 2 と同じ手段）

| ゲート | 結果 |
|---|---|
| lint | ✅ 158 files, no fixes needed |
| typecheck | ✅ 全 9 workspace projects |
| test:run | ✅ 648 passed / 1 skipped / 0 failed |
| audit | ✅ No known vulnerabilities |
| lint:model-ids | ✅ |

**Task 4 完了。**

---

## Task 5: ガイド背骨 `docs/guide/`

### 実行日時
2026-09-21（Task 4 完了直後）

### 構成

`docs/guide/README.md` を索引とし、8 手法（PE/CE/LE/HE/AE/AO/MCP/EV）に 1 ページずつ
（計 9 ファイル）。各ページは 1〜3 文の導入 + (a) ハブ内実装 (b) 兄弟 repo 教材
(c) 正本レビューの X-n、の 3 リンク群のみで構成し、本文は複製していない（R5.2）。

索引には書籍原稿 14 章（`pydantic-ai-agentic-patterns/docs/part{1..5}/ch{01..14}.md`）と
8 手法の対応表も含めた。リンクは GitHub blob URL（別リポジトリのため相対パスが使えない）。
実体移設は行っていない（R5.3、Phase 3 の裁定に従う）。

`docs/agentic-engineering-review.md` には既存の「状態注記」形式（2026-07-26 分）に倣い、
2026-09-21 分の 1 段落を追記（`docs/guide/` へのリンクのみ、本文は不変）。
`CLAUDE.md` / `AGENTS.md` をペアで更新し、`docs/guide/` への参照を追加。

### 執筆時の訂正

`harness-engineering.md` の初稿で「このハブの `AGENTS.md` に X-10 の SSE 罠 1.・2. が
記載済み」と書いたが、これは**旧 `vaz-agentic-ai-next`（現 `specs/inherited/`）の
`AGENTS.md` についての記述**であり、このハブ自身の `AGENTS.md` には該当する記載が
無いことを `grep` で確認して訂正した（誤った事実主張を防いだ一例）。

### R5.4 — コード・CI 非変更の確認

```
git diff --name-only  → docs/agentic-engineering-review.md, CLAUDE.md, AGENTS.md,
                         docs/guide/**（新規）, specs/006-repo-consolidation/** のみ
```

`apps/`, `packages/`, `services/`, `.github/workflows/` への変更は一切無し。

### NFR-2 検証結果

| ゲート | 結果 |
|---|---|
| lint | ✅ 158 files（docs/guide の md はスコープ外。ファイル数は Task 4 と同じ） |
| typecheck | ✅ 全 9 workspace projects |
| test:run | ✅ 648 passed / 1 skipped / 0 failed |
| audit | ✅ No known vulnerabilities |
| lint:model-ids | ✅ |

**Task 5 完了。** NFR-1 のとおり、Task 6（`services/api`）の未決定を待たずに独立着地した。

---

## Task 6: 第 2 Python レーン `services/api`

### 実行日時
2026-09-21（Task 5 完了直後）

### 取り込み手段

`git subtree add --prefix=services/api fastapi-src/main --squash`（`fastapi-src` は
`https://github.com/Fukuchan77/fastapi-pydantic-ai-agent`、fetch した `main`@`c12ac7f`
から取得。ローカルの浅い clone は fetch 元として使えなかったため GitHub から直接 fetch した）。
squash マージにより 2 コミットで導入（`11a87f5` squash 本体 / `cec9be6` ラッパー）。
303 ファイル・43,592 行が一致することを確認（統合計画の実測値と完全一致）。

### R6.1 — 独立レーンの確認

`services/api/pyproject.toml` ＋ `uv.lock` はそのまま。ルート `pyproject.toml` / `uv.lock` は
作成していない。`uv sync --all-extras --dev` を `services/api/` で実行し、Python 3.13.12 を
自動解決・全依存を解決できることを確認済み。

### R6.2 — mise タスクの移送

`services/api/mise.toml`（16 タスク）を root `mise.toml` へ `api:` 接頭辞 ＋
`dir = "services/api"` で移送し、ネストした `mise.toml` は削除した。理由:
移送元の裸タスク名（`lint`/`test`/`dev`/`build`/`audit`）がハブの TS 側タスクと衝突するため、
かつネストした `mise.toml` は `mise run` の設定解決を `services/agent` のパターン
（ネストなし、root 一元管理）と非対称にしてしまう。

新規に **`api:check`**（R6.2 の要求どおり `py:check` と同型の集約ゲート）を追加:
`uv sync → ruff check → ty check → pytest(unit+integration+e2e, coverage) → api:audit`。
`check` の依存には加えていない（NFR-1）。移送元の pip-audit `--ignore-vuln` 理由コメント
（starlette/chromadb/nltk の 3 グループ、計 81 行）は一字一句そのまま `api:audit` へ移した。

`api:hooks:install`（`uv run pre-commit install`）は**ポートしなかった** — 対象の
`.pre-commit-config.yaml` を削除したため（後述）。

### R6.3 — CI ワークフロー

`.github/workflows/api.yml` を新規作成。`python.yml` と同一の形（path-filtered、
`tests.yml` の `gate` 集約に**含めない**、least-privilege `permissions: contents: read`）。
ステップは移送元 `pr.yml` の内容を反映: `mise run api:check` → Redis サービスコンテナ上で
`EXPECT_LIVE_TESTS=7 mise run api:test:redis`。`jdx/mise-action` の SHA は既存 6 ワークフローと
同一のもの（`c2a87611a18de5b3828c5652fe268e992400cb5c # v4`）を再利用し、新規 SHA を持ち込んでいない。

`.github/dependabot.yml` に `directory: "/services/api"` の `uv` エコシステムを追加。
移送元 `ignore:` リスト（`fastapi`/`starlette`/`chromadb`/`redis` の理由コメント込み）を verbatim 移植。

### R6.4 — model-ID ゲートの精密化（案 c を採用）

実測: `services/api` を素の substring パターンで走査すると **3 箇所**（いずれも docstring 内の
書式例）が誤検出される。`scripts/forbid-model-ids.sh` の `PATTERN` を
`[:=]\s*"[a-zA-Z0-9_./:-]*(claude-[a-z0-9]|...)"` へ精密化し、代入文脈（`:`/`=` の直後の
引用符）のみを検出するよう変更。移送元の `test_no_hardcoded_model_ids.py` 自身の
`[:=]\s*"(provider):...` パターンと同じ設計思想（代入形のみ検出）を、ハブ側のベンダー部分
文字列マッチング方式に一般化した形。

検証: 3 箇所の docstring は精密化後に green。合成テスト（`const model = "claude-opus-5";` 等
3 パターン）で真陽性が引き続き検出されることを確認。一時的に実ファイルへ違反を注入する
sanity check でも実際に赤くなることを確認（注入・確認後に削除）。

### R6.5 — carve-out ドリフト検出テスト

`tests/repo/model-id-gate-precision.spec.ts`（新規、4 テスト）:
1. 実リポジトリに対してデプロイ済みスクリプトを実行し green であることを確認
2. 一時ディレクトリへスクリプトをコピーし、代入形の真陽性が引き続き検出されることを
   subprocess 実行で確認
3. 同様に docstring 形の偽陽性が発生しないことを確認
4. `services/api/tests/unit/test_no_hardcoded_model_ids.py` 自身のパターンが
   代入形要求（`[:=]\s*"`）を保持していることを確認 — ハブ側とサービス側が
   独立に緩む事故を検知する

### R6.6 — リポジトリガード 17 件の移送

`tests/` 全体が subtree でそのまま移送されたため大半は自動的に付いてきた。ただし
以下 3 件は移送先の構造（`.github/`/`.pre-commit-config.yaml`/`mise.toml` が
ハブのルートへ移動）と直接衝突するため対応:

| ファイル | 対応 | 理由 |
|---|---|---|
| `test_ci_workflows.py` | **削除** | ハブの `tests/repo/ci-workflows.spec.ts` が既に全 `.github/workflows/*` を汎用的に走査し非空アサート済み（`api.yml` も自動的にカバーされる）。移送元は `pr.yml`/`security.yml` のハードコードパスであり、そもそも存在しない |
| `test_dependabot_config.py` | **削除** | ハブの `tests/repo/dependabot.spec.ts` が `uv` エコシステムの存在を既に検証 |
| `test_pre_push_hook.py` | **削除** | 対象の `.githooks/pre-push` を移送していない（後述の既知ギャップ） |
| `test_python_version_pin.py` | **1 関数のみ削除**（`test_mise_pins_the_same_python_series`） | ハブの `mise.toml` は `[tools].python` を持たない設計（`.python-version` が単一の正）。旧来の「2 箇所が一致すること」という前提自体が構造的に成立しなくなった |
| `test_local_test_gating.py` | **1 関数のみ削除**（`test_ollama_live_test_count_matches_pre_push_hook_literal`） | 同上、対象ファイル不在 |

いずれも `git rm` または個別関数の削除で対応し、削除理由をファイル内 docstring に記録した。
`test_ci_workflows.py`/`test_dependabot_config.py`/`test_pre_push_hook.py` 削除後の
pytest 実測は **1462 passed, 3 skipped, 0 failed**（削除前 1461 passed / 3 failed から回復）。

### R6.7 — load-bearing 依存上限の保持確認

`services/api/pyproject.toml` は subtree import でそのまま持ち込まれており改変していない。
`fastapi>=0.136.3,<0.137` / `starlette>=0.52.1,<1.0` / `pydantic-ai-litellm>=0.2.8,<0.3.0`
の 3 件を `grep` で再確認済み。`services/agent`（`fastapi>=0.141.1`）との同居は
両者 `requires-python = ">=3.13"` の独立レーンとして成立（統合計画 §4.2）。

### R6.8 — CLAUDE.md/AGENTS.md（ペア × 2 箇所）

- `services/api/CLAUDE.md` / `AGENTS.md`: 冒頭に移送に伴う変更点（`.github/`・
  `.pre-commit-config.yaml`・`.githooks/`・`mise.toml` の移動先、削除した 3 テストファイル、
  model-ID ゲートの精密化）を記す note ブロックを追加。**本文はそれ以外変更していない**。
- ハブの `CLAUDE.md` / `AGENTS.md`: 参照のみの短い言及（`CLAUDE.md` は 1 文追加、
  `AGENTS.md` は新規 "## Python API lane (`services/api`)" セクションを追加し、
  `services/api/CLAUDE.md` への誘導のみで本文は複製していない）。

### 副作用: biome フォーマッタ（2 件目）

`services/api/evals/golden/basic_qa.json`（2-space インデント）がハブの tab 規約と衝突。
`biome check --write` で再フォーマットし、`json.load()` による意味的完全一致を確認
（Task 4 の `spec.json` と同じ対応パターン）。

### 既知のギャップ（申し送り）

1. **pre-commit / pre-push フックが未配線**。`services/api` 独自の gitleaks・pip-audit・
   model-ID pygrep フック、および Ollama ゲート付き pre-push プローブは、ハブの共有
   `.githooks/pre-push`（現状 Playwright E2E のみ）に統合していない。フォローアップ課題として
   `services/api/CLAUDE.md` 冒頭の note と `AGENTS.md` の "Python API lane" 節に明記した。
2. **`.gitleaksignore`（365 件の指紋リスト）は移送していない**。squash import により
   全コミットが新しい SHA を持つため、コミットハッシュに基づく指紋は元々無効になる
   （`services/api/CLAUDE.md` 自身が「新しいコミットは新しい指紋を持つ」と説明する仕組み）。
   gitleaks 自体がまだ配線されていないため実害はないが、配線時には再スキャンが必要。

### NFR-2 検証結果（最終）

| ゲート | 結果 |
|---|---|
| lint（TS, biome） | ✅ 160 files |
| typecheck（TS） | ✅ 9 workspace projects |
| test:run（TS, vitest） | ✅ 652 passed / 1 skipped / 0 failed（新規 4 件含む） |
| audit（TS, pnpm audit） | ✅ No known vulnerabilities |
| lint:model-ids | ✅ |
| lint（Python, ruff check） | ✅ |
| format（Python, ruff format --check） | ✅ 300 files |
| typecheck（Python, ty） | ✅ |
| test（Python, pytest unit） | ✅ 1462 passed / 3 skipped / 0 failed |
| audit（Python, pip-audit） | ✅ No known vulnerabilities, 14 ignored |

**Task 6 完了。**

---

## Task 7: パターンカタログの取捨選択

### 実行日時
2026-09-21（Task 6 完了直後）

### 決定: 教材コードは物理的に移設しない

R7.2（「教材用の単純版をガイドの正本とする」）は移設を明示的には要求していない。
Task 6（本番アプリ `fastapi-pydantic-ai-agent` の移設）と対比して判断した:

- Task 6 の対象は**単体で動く本番アプリケーション**であり、ハブの一部として実際に
  デプロイ・運用される。移設しない理由がない。
- Task 7 の対象（`pydantic-ai-agentic-patterns/src/part{3,4,5}_*`）は**書籍の実装コード**で、
  `docs/part{1..5}/ch{01..14}.md` と 1 対 1 対応する。Phase 1（Task 5, R5.3）で書籍原稿 14 章を
  **リンク参照のみ**と決めており、コードだけを先に移設すると解説と実装が別リポジトリに
  分裂し、読者体験が悪化する。章ごと移設するなら Phase 1 の判断のやり直しであり、
  Phase 3 の軽量な「取捨選択」の範囲を超える。

判断の詳細は `plan.md` §2.7 に記録した。

### R7.1/R7.2 — 6 パターンの正本表

`docs/guide/agentic-engineering.md` に、Anthropic 6 パターンそれぞれの
「教材用の単純版（正本）」と「比較版（sandbox、3 FW、参照のみ）」を対応させる表を追加した。
14 ファイル・ディレクトリパスをすべて実在確認済み（`ls`/`test -e` で個別に検証）:

| パターン | 正本 | 比較版 |
|---|---|---|
| Prompt Chaining | `src/part3_workflows/prompt_chaining.py` | `patterns/prompt-chaining/` |
| Routing | `src/part3_workflows/routing_workflow.py` | `patterns/routing/` |
| Parallelization | `src/part3_workflows/parallel_workflow.py` | `patterns/parallelization/` |
| Evaluator-Optimizer | `src/part3_workflows/evaluator_optimizer.py` | `patterns/evaluator-optimizer/` |
| Orchestrator-Workers | `src/part4_multi_agent_rag/research_system/orchestrator.py` | `patterns/orchestrator-workers/` |
| Autonomous Agent | `src/part5_production/guarded_agent.py`（部分的） | `patterns/autonomous-agent/` |

`I-H10`（`pydantic-ai-agentic-patterns/specs/review/integrated/findings.md:455` で実在確認）
への言及と、`services/api/app/agents/guardrails.py:40` の閉じた `StopReason` 語彙
（`grep` で実在確認: `Literal["completed", "max_iterations", "budget_exceeded", "denied",
"disallowed_tool"]`）を移植機会として追記した（R8.5 の先取り言及）。

### R7.3 — 不発火の確認

移設していないため、`src/part1_foundations/prompt_caching.py:30` /
`src/common/settings.py:37` の model-ID 2 箇所はハブの走査対象にならない。
`bash scripts/forbid-model-ids.sh` を再実行し、追加の carve-out なしで green
であることを確認した。

### R7.4 — 確認

`specs/review/`（`pydantic-ai-agentic-patterns` の点時記録）は移設していない
（そもそも同リポジトリから何も移設していないため自明）。

### NFR-2 検証結果

git diff は `docs/guide/agentic-engineering.md` と本 spec の文書 3 ファイルのみ
（`apps/`/`packages/`/`services/`/`.github/` への変更なし）。lint（160 files）/
typecheck（9 projects）/ test:run（652 passed）/ audit / lint:model-ids すべて green。

**Task 7 完了。** NFR-1 のとおり、コード移動ゼロで独立着地した。

---

## Task 8: ギャップ充填・参照整合・旧 repo 整理

### 実行日時
2026-09-21（Task 7 完了直後）

### R9.1 — 参照検証の実装と実行

2 段構成で実装した:

1. **`tests/repo/cross-repo-reference-resolution.spec.ts`**（CI 常時実行、4 テスト）。
   ハブ自身の tree だけから到達可能な範囲（ハブの 2 参照 ＋ Task 6 で `services/api` に
   取り込まれた 3 参照 = 計 5 件）を対象に、正規表現で「reponame-qualified 参照」を抽出し
   現ハブ名（`vaz-agentic-ai-next`）を名乗っているかを検証。非空アサート含む。
   - 実装中に自分の誤りを 1 件訂正: 当初「言及があれば qualified 形式を要求する」設計にしたところ、
     ハブ自身の `CLAUDE.md`/`AGENTS.md`/`docs/guide/` 等の**同一リポジトリ内の相対リンク**
     （qualifier 不要が正しい）を誤検知した。qualified 形式（`reponame/docs/...`）が実際に
     現れた箇所だけを検査する設計へ訂正。
   - もう 1 件: `pdca/do.md` 自身が Task 3 の記録として古い grep 除外パターンを引用符付きで
     残しており（`vaz-ai-next/docs/cross-repo-adoption-review.md` という文字列そのもの）、
     これも誤検知した。`specs/*/pdca/` を運用ログとしてスキャン対象から除外して解決。
2. **`scripts/verify-cross-repo-references.sh`**（CI 非配線、兄弟リポジトリ checkout 前提）。
   実行結果:

   ```
   === Summary ===
   Scanned 7 reference(s) total across reachable files.
   ✅ [verify-cross-repo-references] all reachable references resolved to
      vaz-agentic-ai-next/docs/cross-repo-adoption-review.md
   ```

   **7 / 7 全件解決を確認**（ハブ自身 2 件・`services/api` 3 件・`pydantic-ai-sandbox` 2 件）。
   sibling checkout が無い環境での graceful degradation（5 / 7 を検証し `[skip]` で
   残り 2 件を明示、exit 0）も動作確認済み。

### R9.2 — `pydantic-ai-agentic-patterns` への注記

`pydantic-ai-agentic-patterns/specs/review/INDEX.md` へ 1 行の注記を追加し、
同リポジトリの `claude/busy-hopper-5psrh2` ブランチへ直接 push した（コミット `4d2939f`）。
表・ディレクトリ名（`vaz-ai-next/`）・本文は変更していない（追記のみ規約）。

### R8.3/R8.4 — ADR-0004

`docs/adr/0004-stop-reason-vocabulary.md` を起票。ADR-0001/0002 と同一の
Status/Date/仕様根拠ヘッダ構成。起票前に TS 側の実際のデータフローを再検証:
`runStopReasonSchema` は `runMetricsSchema`（`stopReason` フィールド）を経由して
`runAuditEntrySchema`（監査ログ永続化）と `JobEvent.completion.metrics`（SSE）の
両方へ流れることを `grep` で確認済み（spec.md の「audit_log テーブルに既出」という
表現は正確には `runAuditEntrySchema` 経由であり、ADR 本文はその正確な経路で記述した）。

`docs/guide/loop-engineering.md` を更新: ADR-0004 への直接リンクに切り替え、
`services/api/app/agents/guardrails.py`（Task 6 でハブ内実装になった）を
「(b) 兄弟リポジトリの教材」から「(a) このハブでの実装」へ移設した。

### R8.1/R8.2/R8.5 — 任意項目

いずれも不採用・未実施のまま。Requirement が「採用/実施する場合」の条件付きであるため
違反ではない。`pdca/act.md` に申し送りを記録。

### R9.3/R9.4 — `pdca/act.md`

新規作成。統合計画からの主要な乖離 5 件、学び 5 件、申し送り 6 件を記録。
`beeai-agentic-ai-sandbox` の境界外扱い（R9.3）と旧リポジトリのアーカイブ判断
（R9.4 — 3 repo とも現時点でアーカイブしない、理由つき）を含む。

### NFR-2 検証結果（最終）

| ゲート | 結果 |
|---|---|
| lint | ✅ 161 files |
| typecheck | ✅ 9 workspace projects |
| test:run | ✅ 656 passed / 1 skipped / 0 failed（新規 4 件含む） |
| audit | ✅ No known vulnerabilities |
| lint:model-ids | ✅ |
| `verify-cross-repo-references.sh`（兄弟 checkout あり） | ✅ 7 / 7 |

**Task 8 完了。全 8 Task 完了。`specs/006-repo-consolidation` の全 Requirement に対応した。**
