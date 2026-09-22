# 007-cross-repo-adoption-closeout — PDCA Do Phase

実装ログ。append-only（着地済みの記録は変えない）。散文は日本語、識別子・パス・コードは英語。

---

## タスク 1 — 先行ブロッカー（2026-09-22）

### 実施内容

`tests/repo/cross-repo-reference-resolution.spec.ts` の 1 ファイルのみを変更。

**変更の核心**:
- `QUALIFIED_FORM` を関数スコープのインライン定義からモジュール先頭の定数へ昇格
- 文字クラスを `[A-Za-z0-9_.-]` → `[A-Za-z0-9_-]`（ドット除外）に変更
- 回帰テスト 3 件を新規 `describe` ブロックとして追加（`findReferencingFiles` のファイルスキャンより前に配置）

**PROVE 証拠（非空虚性の確認）**:

バグ復元（`[A-Za-z0-9_.-]+`）時の実行結果:
```
node -e "
const buggyRegex = /([A-Za-z0-9_.-]+)\/docs\/cross-repo-adoption-review\.md/g;
const input = '[正本レビュー](../../docs/cross-repo-adoption-review.md) を参照';
const matches = [...input.matchAll(buggyRegex)];
console.log('matches:', matches.length, matches.map(m => m[1]));
"
# → matches: 1 [ '..' ]
```

テスト `"relative link ... yields zero qualified matches"` が `expect(matches).toHaveLength(0)` で失敗:
```
AssertionError: ../../ should produce no QUALIFIED_FORM match — it contains no repo-name segment
Expected length: 0
Received length: 1
```

修正後（`[A-Za-z0-9_-]+`）: `matches.length = 0` → テスト GREEN。

### ゲート結果

```
pnpm exec vitest run --project repo tests/repo/cross-repo-reference-resolution.spec.ts
✓ repo  tests/repo/cross-repo-reference-resolution.spec.ts (7 tests) 67ms
Test Files: 1 passed (1)  |  Tests: 7 passed (7)
```

```
mise run check
Test Files: 65 passed (65)
Tests: 662 passed | 1 skipped (663)
```

### 既知の限界（記録）

`findReferencingFiles` は `stripCode` を持たず生テキストを走査するため、コードスパンや
fenced block 内でパスを話題にするだけでも `QUALIFIED_FORM` にマッチする可能性がある
（第 2 の偽陽性クラス）。これは plan.md C-5 の既知限界として明示的に残す。
現在の走査対象（`specs/` を含む全 `.md`、`pdca/` のみ除外）では実害が確認されていない。

### 学び

- 「関数内インライン定数」は回帰テストが書きにくい。昇格コストが低い場合は最初から
  モジュール先頭に置くと、テストと実装が同じ変数を共有して戻し変更が即座に両スイートを赤にする
- 既存 4 テストの意図・アサーション文言を一切変えずに修正できた（ADR-3 の「最小変更」）

---

## タスク 2 — 対応表ガードを先に用意する（2026-09-22）

### 実施内容

`tests/repo/owasp-mapping-citations.spec.ts` の 1 ファイルを新規作成。
変更ファイルは `_Boundary:_` に宣言された 1 本のみ（`tasks.md` の checkbox 更新を除く）。

**実装の核心**:
- `MAPPING_DOCS` 定数配列（2 パス）で対象文書を宣言。ガードは文書から語彙・パスを学ばない
- 非空アサート群（走査数 = 2、実在確認、引用数 > 0、状態トークン数 > 0、索引行数 = 15）を
  検査本体より前に置き、走査 0 件で緑になる偽陽性経路を塞ぐ（R4.6）
- `parseSections`: level-2 heading (`## …`) 単位でセクションを分割し、
  `- 状態: / 実装: / テスト: / CI: / 再評価トリガ:` のキー行のみを収集
- `classifySpan`: 既知拡張子 + `/` ヒューリスティックでパス vs シンボルを判別（IF-3 verbatim）。
  シェルコマンド（スペース含む）はシンボルに分類 → LLM 文書の既存行は失敗する（意図的）
- `parseThreatIndex`: `---` 区切り行で表を検出し `脅威` 列ヘッダを探す。15 行 + 全単射を検査
- CI 引用は `yaml.parse` で構造的に `name:` 値を収集（文字列検索しない。R4.3 verbatim）
- `VALID_STATUS_TOKENS` はガード側定数（ハードコード）——文書から学ばせない（task 2.3 の要件）

**PROVE 証拠（非空虚性の確認）**:

新規ガードの RED 確認（期待値通り）。文書が存在しない／新フォーマット未移行の時点での
実行結果:
```
pnpm exec vitest run --project repo tests/repo/owasp-mapping-citations.spec.ts
Tests: 17 failed | 7 passed (24)
```

失敗内訳:
- Agentic 文書: ENOENT（新ファイル名 `owasp-agentic-threats-mitigations-mapping.md` 未存在）
- LLM 文書: `- 状態:` 行が 0 件（新フォーマット未移行）、バージョン日付なし、
  シェルコマンドスパンをシンボルとして解決できない

7 つの PASS テスト（ガード実装自体は正しい）:
- `exactly 2 mapping documents are declared`
- `document exists: docs/owasp-llm-top10-mapping.md`
- `LLM document contains at least 1 structured citation`
- `all path citations in docs/owasp-llm-top10-mapping.md exist`
- `all CI citations in docs/owasp-llm-top10-mapping.md are valid`
- `all status tokens in docs/owasp-llm-top10-mapping.md are valid`
- `all accepted sections in docs/owasp-llm-top10-mapping.md have re-evaluation triggers`

**回帰確認（既存 6 repo テスト）**:
```
pnpm exec vitest run --project repo tests/repo/cross-repo-reference-resolution.spec.ts \
  tests/repo/doc-links.spec.ts tests/repo/ci-workflows.spec.ts tests/repo/dependabot.spec.ts \
  tests/repo/hermetic-network.spec.ts tests/repo/model-id-gate-precision.spec.ts
Test Files: 6 passed (6)  |  Tests: 21 passed (21)
```

**lint / typecheck**:
```
pnpm exec biome check tests/repo/owasp-mapping-citations.spec.ts
→ Checked 1 file in 10ms. No fixes applied.

pnpm exec tsc --noEmit
→ (exit 0, no errors for owasp-mapping-citations.spec.ts)
```

### ゲート状態（意図的な RED）

憲章 principle 9（テストを先に書く）。この時点では:
- `docs/owasp-agentic-threats-mitigations-mapping.md` 未存在（Task 3 で作成）
- `docs/owasp-llm-top10-mapping.md` は新フォーマット未移行（Task 4 で移行）

ガードは Task 4.4 の完了時点で緑になることを確認する予定（tasks.md の記述通り）。

`mise run check` はこの RED を含むため、**本タスクの ship 対象は Task 2 単体**であり、
全体ゲートではなく Task 2 の boundary に限定した証拠で validate する（TDD 守則）。

### 学び

- `parseSections` が level-2 heading のみを拾う設計は、冒頭の prose（索引表・語彙定義）を
  セクション扱いせず正しくスキップする。ただし H3 以下の脅威節が存在する場合は拾えない
  ——文書設計として脅威節は H2 に限るという不文律が必要
- シェルコマンドがシンボル扱いされる点は意図的な failing case：Task 4 で文書が
  `(grep -rn dangerouslySetInnerHTML apps/web/src)` を散文へ移動すれば解消する
- `parseThreatIndex` は `脅威` 列を header text で検出する。列名が変わると「索引 0 行 → 非空アサート失敗」
  になり、サイレントパスにならない（anti-false-green 設計が機能している）
