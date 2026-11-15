# 011-node-26-runtime-upgrade

## Project Description

update node 26

TS ランタイムの Node を 24 LTS（24.22.3）から 26 LTS（26.13.1、Lithium、26.13.0 から LTS）へ上げる。

### 事前検証の結果（2026-11-15、`/dependency-security-refresh`）

- ランタイムだけを 26 にすると `mise run check` が 2 件失敗した。
  - `apps/worker/typescript-loader.mjs` の `stripTypeScriptTypes({ mode: "transform" })` が Node 26 で `ERR_INVALID_ARG_VALUE` になる（worker コンテナの `CMD` が通るため起動不能）。
  - `tests/repo/container-toolchain-pins.spec.ts` が Dockerfile の `NODE_VERSION=24` との不一致を検出した。
- `module.register()` が Node 26 で非推奨（DEP0205）。
- 修正（`mode: "strip"`、`registerHooks()` への移行、各ピンの更新）後は Node 26 で `mise run check` が緑（80 ファイル / 949 passed, 1 skipped）、`build` / `size` / `openapi:gen` も差分なし。
- 未検証: worker の Docker イメージビルドと起動、firefox の E2E（Node 24 でも起動しない環境要因）、`test:e2e:ollama`、Inngest/DB/Redis に接続した worker の実走。
- 変更は worktree `/Users/Shared/codes/vaz-agentic-ai-next-node26` に未コミットで残っている。

## Clarifications

### Session 2026-11-15

- Q: Node 26 への移行範囲はどこまでにしますか? → A: 一括移行。ランタイム・型・ガード・ガバナンス文書・利用者向け記述を 1 つの spec で揃え、事前検証の worktree 変更を土台にする。
- Q: worker イメージのビルドと起動をどこまで完了条件にしますか? → A: イメージ起動まで必須。`mise run check`・`build`・`size`・`openapi:gen` に加え、`docker build` の成功と、コンテナ内で worker のモジュールグラフが `DeprecationWarning` なしに読み込めることを完了条件にする（Docker のある環境か CI で実施）。docker compose での Inngest 接続実走は必須にしない。
- Q: Node と直接関係しない項目（Python レーン、ローカル firefox E2E など）は対象外にしてよいですか? → A: 対象外にする。E2E は CI の結果で判定する。
- Q: 問題が出たとき Node 24 へ戻せる状態をどこまで保証しますか? → A: revert で戻せる構成にする。Node 24/26 両対応のローダー修正を先のコミットに分け、版のピン変更を 1 コミットにまとめる。版コミットだけを revert すれば Node 24 に戻り、ローダーの回帰テストは Node 24 でも緑のまま。`engines.node` は `>=26`。

## Success Criteria

- Node 26.13.1 で `mise run check` が緑（件数を記録）、`mise run build` / `mise run size` が予算内、`mise run openapi:gen` で生成物に差分なし
- `apps/worker` のイメージが `node:26-slim` ベースで `docker build` に成功し、コンテナ内で worker の全モジュールが `DeprecationWarning` なしに読み込める
- Node 24 では worker ローダーの回帰テストが緑のまま（ロールバック可能性の確認）
- ローダー修正と版のピン変更が別コミットになっており、版コミットだけを revert すると Node 24 で `mise run check` が緑に戻る

## Scope

- In scope:
  - ランタイムのピン: `mise.toml` `[tools] node`、`apps/worker/Dockerfile` `ARG NODE_VERSION`、`apps/worker/package.json` `engines.node`
  - 型: root と `apps/worker` の `@types/node` を 26 系へ、`.github/dependabot.yml` の hold を `>=27` へ、`tests/repo/dependabot.spec.ts` の `heldMajor` を 26 へ
  - 互換修正: `apps/worker/typescript-loader.mjs`（`mode: "strip"`）、`apps/worker/register-typescript-loader.mjs`（`registerHooks()`）、DEP0205 回帰テスト
  - ガバナンス: `.sdd/memory/constitution.md`（Node 24 LTS の記述）、`.sdd/steering/tech.md`、`docs/dependency-policy.md`
  - 記述: `README.md`、`AGENTS.md`、`CLAUDE.md`、`docs/cross-repo-adoption-backlog.md`、`docker-compose.yml` と worker 内のコメント
- Out of scope:
  - Python レーン（`services/agent`・`services/api`）の版上げ
  - ローカル firefox E2E の起動不具合（Node 24 でも再現する環境要因。E2E は CI の結果で判定）
  - pnpm・TypeScript など他ツールの版上げ、Node 27 以降
  - 実験的 API `stripTypeScriptTypes`（ExperimentalWarning）からの脱却や worker のビルド導入

## Glossary

| 用語 | 定義 |
|---|---|
| 正本 | ある版を決める唯一の箇所。Node は `mise.toml` の `[tools] node`（憲章 Additional Constraints「ツールチェーン」） |
| 追随箇所 | 正本に合わせる他の箇所。`apps/worker/Dockerfile` の `ARG NODE_VERSION`、`apps/worker/package.json` の `engines.node`、`@types/node` の範囲、Dependabot の hold |
| worker ローダー | `apps/worker/register-typescript-loader.mjs` と `apps/worker/typescript-loader.mjs`。`pnpm deploy` 後に `node_modules` 配下へ置かれた source-only の `@vaz/*` を、Node 自身の型除去で読み込む |
| 型除去 | 型注釈だけを取り除き、それ以外のコードを変えない変換。enum・namespace・パラメータプロパティなど、消すだけでは済まない構文は受け付けない |
| 版コミット | 正本と追随箇所の版だけを変えるコミット。revert すると Node 24 へ戻る |
| ベータレーン記録 | `docs/dependency-policy.md` §8.2 の手順 1 が求める、新メジャーの検証記録 |

## Requirements

### Requirement 1: worker ローダーを Node 24 と 26 の両方で動かす

Node 26 では `stripTypeScriptTypes` の `mode: "transform"` が廃止され、`module.register()` が非推奨（DEP0205）になった。worker コンテナの起動経路はこの 2 つを通るため、版を上げる前にローダーを両方の版で動く形にする。

**Acceptance Criteria**

1.1 THE worker ローダー SHALL Node 24 系と Node 26 系のどちらでも、`@vaz/config/logger` と `apps/worker/src` の全モジュールを読み込み、終了コード 0 で終わる。
1.2 WHEN worker ローダーを Node 26 系で使う, THE worker ローダー SHALL stderr に `DeprecationWarning` を出さない。
1.3 THE worker ローダー SHALL 型除去だけでモジュールを変換し、型除去で扱えない構文をコード変換で受け入れない。
1.4 IF worker が読み込むソースに型除去で扱えない構文が含まれる, THEN THE リポジトリの typecheck SHALL それを型エラーとして検出する（`erasableSyntaxOnly`）。
1.5 THE worker ローダーの回帰テスト SHALL 1.2 を検査し、修正前の登録方法では Node 26 系で失敗することを確認済みである。
1.6 WHEN 例外のスタックトレースを出す, THE worker SHALL 元のソースと同じ行番号・列番号を示す。

### Requirement 2: 実行環境の Node を 26 LTS にする

**Acceptance Criteria**

2.1 THE 正本 SHALL Node のメジャーを 26 と宣言する。
2.2 THE `apps/worker/Dockerfile` SHALL 正本と同じメジャーの `node:<major>-slim` をビルド段と実行段の両方のベースイメージに使う。
2.3 THE `apps/worker/package.json` SHALL `engines.node` を `>=26` と宣言する。
2.4 WHEN CI のジョブが Node を用意する, THE CI SHALL 正本から版を読み、ワークフローの中に Node の版を別に書かない。
2.5 IF Dockerfile の `NODE_VERSION` が正本のメジャーと一致しない, THEN THE repo ガード（`tests/repo/container-toolchain-pins.spec.ts`）SHALL 失敗する。

### Requirement 3: 型定義と更新提案を実行環境に揃える

`@types/node` は実行環境の Node に合わせる、という既存の規則（`docs/dependency-policy.md` §8.1）を新しい版で保つ。

**Acceptance Criteria**

3.1 THE root と `apps/worker` の `package.json` SHALL `@types/node` を 26 系の範囲で宣言し、ロックファイルの解決結果も 26 系である。
3.2 THE `.github/dependabot.yml` SHALL `@types/node` の 27 以上への更新提案を止め、26 系の minor/patch の提案は止めない。
3.3 IF `@types/node` の範囲のメジャーと Dependabot の hold が食い違う, THEN THE repo ガード（`tests/repo/dependabot.spec.ts`）SHALL 失敗する。
3.4 THE `.github/dependabot.yml` の hold の理由コメント SHALL 正本のメジャー（26 LTS）を示す。

### Requirement 4: 憲章とガバナンス文書を同時に改める

憲章は「Node 24 LTS は `mise.toml` が正本」と明記しており、steering は宣言済みの版を勝手に変えることを禁じている。版を変えるには、同じ変更の中で憲章を改正する必要がある（Governance「両者を同時に更新する」）。

**Acceptance Criteria**

4.1 THE 憲章（`.sdd/memory/constitution.md`）SHALL Additional Constraints「ツールチェーン」で Node 26 LTS を正本の版として示す。
4.2 THE 憲章 SHALL Amendment procedure に従い、版の昇格、改訂履歴の行、Sync Impact Report を同じ変更で記録する。
4.3 THE 憲章の版の上げ幅 SHALL 宣言済み版の変更として MINOR とする（前例: 2.3.0 の Python 3.14 化）。
4.4 THE `.sdd/steering/tech.md` の Constraints SHALL Node 26 LTS を宣言済みの版として示す。
4.5 THE `docs/dependency-policy.md` SHALL §8.1 の `@types/node` の行を 26 の据え置きに改め、§8 のベータレーン表から取り込み済みの Node 26 を外す。
4.6 THE 版を上げる PR SHALL `docs/dependency-policy.md` §8.2 の手順 1 が求める検証記録へのリンクを本文に持つ。

### Requirement 5: 利用者と agent 向けの記述を揃える

**Acceptance Criteria**

5.1 THE `README.md`（英語・日本語の両節）SHALL 前提とする Node を 26 LTS と示す。
5.2 THE `AGENTS.md` と `CLAUDE.md` SHALL `@types/node` の据え置きを 26（Node 26 LTS）として、同じ変更で揃えて示す。
5.3 THE `docker-compose.yml`、`apps/worker/Dockerfile`、`apps/worker/tsconfig.json`、`apps/worker/src/main.ts` のコメント SHALL worker の実行環境を Node 26 と示す。
5.4 THE `docs/cross-repo-adoption-backlog.md` SHALL 据え置きの記述を Node 26 に合わせる。
5.5 WHEN 変更が終わる, THE リポジトリ SHALL `specs/` 配下の過去の記録を除き、現行の版としての「Node 24」「`@types/node` 24」の記述を含まない（grep で確認する）。
5.6 THE `specs/` 配下の過去 spec の記録 SHALL 書き換えない。

### Requirement 6: 品質ゲートとイメージで検証する

**Acceptance Criteria**

6.1 WHEN Node 26.13.1 で `mise run check` を実行する, THE リポジトリ SHALL 全段で成功し、テストの件数がベースライン（80 ファイル / 949 passed, 1 skipped）から減らない。
6.2 WHEN Node 26.13.1 で `mise run build` と `mise run size` を実行する, THE `apps/web` SHALL ビルドに成功し、`.size-limit.json` の上限（JS 420 kB / CSS 4.0 kB、brotli）を超えない。
6.3 WHEN Node 26.13.1 で `mise run openapi:gen` を実行する, THE 生成物 SHALL コミット済みのものとバイト単位で一致する。
6.4 WHEN `apps/worker/Dockerfile` をビルドする, THE ビルド SHALL 成功する。
6.5 WHEN ビルドしたイメージのコンテナ内で worker の全モジュールを読み込む, THE コンテナ SHALL 終了コード 0 で終わり、stderr に `DeprecationWarning` を出さない。
6.6 WHEN PR の CI が走る, THE CI SHALL 全ジョブ成功で終わる。E2E の合否はこの CI の結果で判定する。
6.7 THE 検証の記録 SHALL 各コマンド、実行した Node の版、結果の件数を残す。終了コードだけの記録は検証として扱わない。

### Requirement 7: Node 24 へ戻せる形でコミットする

**Acceptance Criteria**

7.1 THE 変更 SHALL Requirement 1 のローダー修正を、版コミットより前の独立したコミットにする。
7.2 THE 版コミット SHALL 正本と追随箇所（Requirement 2・3）の変更とロックファイルの更新だけを含む。
7.3 WHEN ローダー修正のコミットだけを適用した状態（版は 24）で `mise run check` を実行する, THE リポジトリ SHALL 全段で成功する。
7.4 WHEN 版コミットだけを revert する, THE リポジトリ SHALL Node 24 で `mise run check` が成功する状態に戻る。
7.5 THE 変更 SHALL 1 つの PR にまとめる（`docs/dependency-policy.md` §8.2「1 メジャーにつき 1 PR」）。

## Non-Functional Requirements

- 互換性: worker ローダーは Node 24 系・26 系の両方で動く（Requirement 1、7）。
- サイズ: client バンドルは brotli で JS 420 kB / CSS 4.0 kB 以内。上限は引き上げない。
- セキュリティ: `pnpm audit --audit-level=moderate` で新しい指摘を増やさない。全履歴の secret scan で検出 0 件を保つ。
- 再現性: Node の版はワークフロー・Dockerfile・ドキュメントで正本以外に独立して決めない。

## Out of Scope / Future Work

- 実験的 API `stripTypeScriptTypes` からの脱却（Node が型除去を安定 API にしたとき、または worker にビルドを導入するときに再検討する）
- docker compose で Inngest Connect に接続した worker の実走
- Python レーン、pnpm、TypeScript の版上げ。Node 27 以降

---

_Initialized: 2026-11-15T14:32:03+0900_
