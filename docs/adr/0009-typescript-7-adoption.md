# ADR-0009: Root workspace での TypeScript 7 採用と OpenAPI codegen 向け TypeScript 6 の隔離

- **Status**: 承認済み（2026-10-05）
- **Date**: 2026-10-05
- **仕様根拠**: [`specs/009-agent-ui-and-beta-intake/spec.md`](../../specs/009-agent-ui-and-beta-intake/spec.md) R5.1, R5.2, R5.3, R5.4, R5.5, R5.6
- **関連レビュー**: [`specs/009-agent-ui-and-beta-intake/reviews/ts7-constitution-r1.md`](../../specs/009-agent-ui-and-beta-intake/reviews/ts7-constitution-r1.md)

散文は日本語、識別子・型・パス・コードは英語（`spec.json` `language: ja`）。

## Context

本リポジトリでは長らく `typescript` 6.x を固定し、7.x への更新を意図的に保留してきた（憲章 Additional Constraints および `TODO(TYPESCRIPT_MAJOR)`）。その主たる理由は、OpenAPI 定義から TypeScript 型定義を生成する `openapi-typescript`（7.13.0）が TypeScript の compiler API に依存しており、TypeScript 7 の breaking changes（AST / compiler API 変更）により codegen 実行時に互換性問題を起こすリスクが存在していたためである。

一方、兄弟リポジトリ `next-agentic-stack` のベータレーン検証記録（`docs/beta-lane/2026-10-03-ts7-compiler-api.md`）において、以下の事実が確認された：
1. `apps/web`、`apps/worker`、`packages/agents`、`packages/evals` など本ワークスペースの実行時コード・テスト・型チェック（`tsc --noEmit`）は、TypeScript 7 環境で正常に動作し、型検査の速度・精度向上の恩恵を受けられる。
2. `openapi-typescript` 7.13.0 は TypeScript 6 の compiler API を前提としており、TypeScript 7 の compiler API 下では動作しない。
3. `openapi-typescript` は独立したパッケージ `@vaz/schemas` の OpenAPI TS codegen（`mise run openapi:gen`）でのみ利用されており、アプリケーション実行時やワークスペース全体の型チェックには関与しない。

## Decision

**ルートワークスペースのコンパイラとして TypeScript 7 を正式採用し、`openapi-typescript` と TypeScript 6.0.3 を `@vaz/schemas` パッケージ内に局所的に隔離する二層コンパイラ構成を採用する。**

1. **二層コンパイラ構成（DES-1.8）**:
   - ルート `package.json` の `typescript` devDependency を stable 7.x（`^7.0.0`）へ昇格する。
   - `packages/schemas/package.json` の devDependencies に `openapi-typescript`（7.13.0）と `typescript`（`6.0.3`）を配置し、`openapi-typescript` 専用の toolchain として TypeScript 6 を所有させる。
   - `mise run openapi:gen` は `@vaz/schemas` の隔離された TypeScript 6 環境を用いて実行し、生成される contracts の byte-identical な同一性を維持する。
   - packages は source-only のままとし、パッケージ単位の build step は追加しない。

2. **Dependabot 管理ポリシー**:
   - `packages/schemas` の `typescript` は `6.0.3` 系に固定し、Dependabot の semver-major hold（または Fallback hold）によって 6→7 の更新を防止する。
   - ルート `typescript` は 7.x 系統の minor/patch 更新を受け入れ、7→8 のメジャー更新は semver-major hold で停止する。

3. **憲章改訂**:
   - `.sdd/memory/constitution.md` の Additional Constraints における「TypeScript は 6.x 継続」の記述を、TS 7 採用と TS 6 隔離構成の記述へ改定する。
   - `TODO(TYPESCRIPT_MAJOR)` を解決済みとして改定・削除する。

## Consequences

- ワークスペース全体（`apps/web`, `apps/worker`, `packages/*`）で TypeScript 7 の最新機能と型検査が利用可能になる。
- `@vaz/schemas` の OpenAPI codegen は TypeScript 6 で安全に動作し続け、生成される TypeScript 契約（`packages/schemas/src/generated/*.ts`）の整合性と後方互換性が保証される。
- 単一の pnpm lockfile を維持したまま、build step のない source-only package 構成を維持できる。

## 撤去・一本化条件（Re-trigger / Retirement Condition）

上流の `openapi-typescript` が TypeScript 7 に正式対応した新バージョンをリリースし、兄弟リポジトリ `next-agentic-stack`（spec 001）での検証が完了した時点で、以下の手順で二層構成を解消しルート TS 7 に一本化する（spec 009 §8 deferred task 8.1 / REQ-028）：
1. `packages/schemas` の `typescript`（6.0.3）devDependency を撤去する。
2. `packages/schemas` の `openapi-typescript` を TS 7 対応版へ更新する。
3. `mise run openapi:gen` をルート TypeScript 7 環境に一本化し、生成物が byte-identical であることを確認する。
4. Dependabot の `packages/schemas` 向け TS 6 hold 設定および関連する repo guard アサーションを撤去する。
