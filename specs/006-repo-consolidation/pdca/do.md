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
