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
