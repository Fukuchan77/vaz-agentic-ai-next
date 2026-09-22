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
