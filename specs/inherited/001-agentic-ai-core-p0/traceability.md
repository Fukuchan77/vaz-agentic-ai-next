# 001-agentic-ai-core-p0 — トレーサビリティマトリクス

**フィーチャー名**: `001-agentic-ai-core-p0`
**日付**: 2026-08-29
**フェーズ**: P0

> このテーブルは `/sdd-ship` フェーズで Test / Commit 列が埋められる。
> Gaps セクションのギャップが「None」であることは明示的な OK 判定である。
> タスク列は `tasks.md` の `_Traces:_` 行と**双方向で一致**していること（第 3 回指摘 M2）。

---

## 要件トレーサビリティ

| 要件 | 設計 | タスク | テスト | Commit |
| :--- | :--- | :--- | :--- | :--- |
| REQ-0.1 | DES-0.1 | T-0.1 | | |
| REQ-0.2 | DES-0.1, DES-6（T-0）| T-0.2 | | |
| REQ-0.3 | DES-0.2 | T-0.2 | | |
| REQ-0.4 | DES-0.2, DES-6.1, DES-7.6 | T-0.2, T-9.0, T-9.1 | test_repo_conventions.py（baseline 比較） | |
| REQ-0.5 | DES-0.2 | T-0.2 | | |
| REQ-0.6 | DES-6（T-0 新規ファイル）| T-0.3 | | |
| REQ-0.7 | DES-3.1.4, DES-3.1.6 | T-0.2, T-9.0, T-9.1 | test_repo_conventions.py | |
| REQ-1.1 | DES-3.1.1 | T-1.1, T-9.1 | test_repo_conventions.py | |
| REQ-1.2 | DES-3.1.2, DES-3.1.6 | T-1.2, T-2.6, T-9.0, T-9.1 | test_repo_conventions.py | |
| REQ-1.3 | DES-3.1.2, DES-3.1.6, DES-2.2 | T-1.2, T-9.0, T-9.1 | test_repo_conventions.py | |
| REQ-1.4 | DES-3.1.3, DES-3.1.6, DES-4.3 | T-1.3, T-2.3, T-2.6, T-9.1 | test_repo_conventions.py | |
| REQ-1.5 | DES-3.1.4 | T-1.4 | | |
| REQ-1.6 | DES-3.1.4 | T-1.4 | | |
| REQ-1.7 | DES-3.1.6, DES-8.3 | T-2.3 | | |
| REQ-1.8 | DES-3.1.5, DES-7.6 | T-1.5, T-9.0, T-9.1 | test_repo_conventions.py | |
| REQ-2.1 | DES-3.2.1, DES-4.3 | T-2.2 | | |
| REQ-2.2 | DES-3.2.1, DES-ADR-P0-02 | T-2.2, T-9.1 | test_repo_conventions.py | |
| REQ-2.3 | DES-3.2.1, DES-3.3 | T-2.3, T-9.0, T-9.1 | test_repo_conventions.py | |
| REQ-2.4 | DES-8.2 | T-2.3, T-5.3 | | |
| REQ-2.5 | DES-4.2, DES-7.2 | T-2.1, T-2.5 | | |
| REQ-2.6 | DES-7.2, DES-8.1 | T-2.1, T-2.5 | | |
| REQ-2.7 | DES-3.1.6, DES-3.2.1 | T-2.2, T-2.6, T-9.1 | test_repo_conventions.py | |
| REQ-3.1 | DES-3.3 | T-3.1 | | |
| REQ-3.2 | DES-3.3 | T-3.2 | | |
| REQ-3.3 | DES-3.3 | T-3.1 | | |
| REQ-4.1 | DES-3.4, DES-7.6 | T-0.2, T-1.4, T-9.0, T-9.1 | test_repo_conventions.py | |
| REQ-4.2 | DES-3.4, DES-4.3 | T-1.3 | | |
| REQ-4.3 | DES-3.1.5, DES-3.4 | T-1.5 | | |
| REQ-5.1 | DES-3.5, DES-7.6 | T-4.1, T-9.2 | test_repo_conventions.py | |
| REQ-5.2 | DES-3.5, DES-7.6 | T-4.1, T-9.2 | test_repo_conventions.py | |
| REQ-5.3 | DES-3.5, DES-7.6 | T-4.1, T-9.2 | test_repo_conventions.py | |
| REQ-5.4 | DES-3.5 | T-4.1 | | |
| REQ-5.5 | DES-ADR-P0-04 | T-4.1 | | |
| REQ-5.6 | DES-3.5, DES-7.6 | T-4.1, T-9.0, T-9.2 | test_repo_conventions.py | |
| REQ-6.1 | DES-3.6, DES-8.1 | T-5.1 | （版ずらし確認 = T-5.1）| |
| REQ-6.2 | DES-3.6, DES-8.1 | T-5.1 | | |
| REQ-6.3 | DES-3.6 | T-1.1, T-5.2 | | |
| REQ-7.1 | DES-3.7, DES-3.1.6, DES-3.1.6a, DES-8.1 | T-8.1, **T-8.1a** | | |
| REQ-7.2 | DES-3.7, DES-3.1.2, DES-3.1.6 | T-8.2 | | |
| REQ-7.3 | DES-3.7, DES-3.1.6a | T-8.3, **T-8.1a** | | |
| REQ-7.4 | DES-7.2, DES-7.7 | T-2.4 | T-2.4（専用テスト＋非空虚確認）| |
| REQ-7.5 | DES-7.5, DES-3.1.6 | T-2.6, T-8.1 | （ガード 3 状態確認 = T-2.6）| |
| REQ-7.6 | DES-7.5a, DES-3.1.6a | T-8.1a | `scripts/check-ts-lanes.sh`（実効性確認込み）| |
| REQ-7.7 | DES-8.1（憲章 TODO(BRANCH_COVERAGE_THRESHOLD)）| T-8.4 | `coverage-baseline.json` | |
| REQ-8.1 | DES-3.8 | T-1.5, T-7.1 | | |
| REQ-8.2 | DES-3.8 | T-5.4 | | |
| REQ-9.1 | DES-3.9, DES-8.1 | T-5.0, T-5.1, T-5.3 | （実在 6 workflow への合流。`ci.yml` は作らない）| |
| REQ-9.2 | DES-8.2 | T-5.3 | | |
| REQ-9.3 | DES-8.4 | T-5.0, T-5.1, T-5.3, T-5.5 | | |
| REQ-9.4 | DES-8.3 | T-5.0, T-5.3 | | |
| REQ-10.1 | DES-3.10 | T-6.2 | | |
| REQ-10.2 | DES-3.10 | T-6.1 | | |
| REQ-10.3 | DES-3.8, DES-3.10 | T-5.4, T-6.2 | | |

---

## Gaps

### 未マッピング要件

None

### 孤立タスク（要件に対応しないタスク）

None

### 検証実体が未実装の要件

None — 第 3 回 `/sdd-analyze` で「アサートテストを検証手段に指定しているがテスト作成タスクが無い」11 要件（REQ-1.1 / 1.2 / 1.3 / 2.2 / 2.3 / 2.7 / 4.1 / 5.1 / 5.2 / 5.3 / 5.6）は **T-9.1 / T-9.2** に、REQ-7.4 の専用テストは **T-2.4** に割り当てた。

---

## カバレッジ統計

- 要件数: **53**（第 7 回で REQ-7.6 / REQ-7.7 を追加）
- タスクにマッピング済み: 53/53 (100%)
- 未マッピング: 0
- うち `[検証: 機械]`: 46 件、`[検証: 目視]`: 7 件
- テスト列が埋まっている要件: **19 件**（第 5 回で REQ-0.4 / 1.8、第 6 回で REQ-0.7、第 7 回で REQ-7.4 / 7.5 / 7.6 / 7.7 の実効性確認列を追加）
- **非空虚性（RED 観測または「壊して確認」）が作業項目として明示されている要件**: **19 件**（T-9.0 / T-9.1 / T-9.2 / T-2.4 / T-2.6 / T-5.1 / T-8.1a）

---

_Generated: 2026-08-29_
