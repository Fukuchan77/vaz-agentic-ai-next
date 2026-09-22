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
