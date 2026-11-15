# 011-node-26-runtime-upgrade

## Project Description

update node 26

TS ランタイムの Node を 24 LTS（24.22.3）から 26 LTS（26.13.1、Lithium、26.13.0 から LTS）へ上げる。26.13.1 は 2026-11-10 のセキュリティリリース（ランタイムの CVE 18 件、うち High 9 件。`next-agentic-stack` PR #75 の記載）で、`next-agentic-stack` は 26.13.1 に更新済みである。

### 事前検証の結果（2026-11-15、`/dependency-security-refresh`）

- ランタイムだけを 26 にすると `mise run check` が 2 件失敗した。
  - `apps/worker/typescript-loader.mjs` の `stripTypeScriptTypes({ mode: "transform" })` が Node 26 で `ERR_INVALID_ARG_VALUE` になる（worker コンテナの `CMD` が通るため起動不能）。
  - `tests/repo/container-toolchain-pins.spec.ts` が Dockerfile の `NODE_VERSION=24` との不一致を検出した。
- `module.register()` が Node 26 で非推奨（DEP0205）。
- 修正（`mode: "strip"`、`registerHooks()` への移行、各ピンの更新）後は Node 26 で `mise run check` が緑（80 ファイル / 949 passed, 1 skipped）、`build` / `size` / `openapi:gen` も差分なし。
- 未検証: worker の Docker イメージビルドと起動、firefox の E2E（Node 24 でも起動しない環境要因）、`test:e2e:ollama`、Inngest/DB/Redis に接続した worker の実走。
- 変更は、当初 worktree `/Users/Shared/codes/vaz-agentic-ai-next-node26` に未コミットで残っていた。この worktree はもう存在しない。同じ 11 ファイルの差分は、主の作業ツリーのブランチ `chore/011-node-26-runtime-upgrade` に未コミットで残っている（`research.md`「着手時点の状態」、`spec.json` の `source_documents.verification.worktree`）。

## Clarifications

### Session 2026-11-15

- Q: Node 26 への移行範囲はどこまでにしますか? → A: 一括移行。ランタイム・型・ガード・ガバナンス文書・利用者向け記述を 1 つの spec で揃え、事前検証の worktree 変更を土台にする。
- Q: worker イメージのビルドと起動をどこまで完了条件にしますか? → A: イメージ起動まで必須。`mise run check`・`build`・`size`・`openapi:gen` に加え、`docker build` の成功と、コンテナ内で worker のモジュールグラフが `DeprecationWarning` なしに読み込めることを完了条件にする（Docker のある環境か CI で実施）。docker compose での Inngest 接続実走は必須にしない。
- Q: Node と直接関係しない項目（Python レーン、ローカル firefox E2E など）は対象外にしてよいですか? → A: 対象外にする。E2E は CI の結果で判定する。
- Q: 問題が出たとき Node 24 へ戻せる状態をどこまで保証しますか? → A: revert で戻せる構成にする。Node 24/26 両対応のローダー修正を先のコミットに分け、版のピン変更を 1 コミットにまとめる。版コミットだけを revert すれば Node 24 に戻り、ローダーの回帰テストは Node 24 でも緑のまま。`engines.node` は `>=26`。

### Session 2026-11-15 (spec レビューの反映)

- Q: ベータレーンの記録(R4.6)はどこに置きますか? → A: `next-agentic-stack` に置く。Node 26 の記録は `Fukuchan77/next-agentic-stack` の PR #77(`docs/beta-lane/2026-11-15-node-26.md`、判定は部分解消)としてマージ済み。ハブ PR の本文からこの記録へリンクする。部分解消の残り(worker ローダーと Docker イメージ)は、ハブ自身のゲートで本 spec の R1・R6 が確かめる。ハブ側で代える案は採らない(§8.2 からの逸脱になるため)。
- Q: イメージの検証(R6.4・R6.5)はどこで実施しますか? → A: ローカルの Docker(Rancher Desktop)で実施し、コマンドと結果を検証記録に残す。ハブの CI にはイメージをビルドするジョブがなく、本 spec では追加しない(Future Work)。
- Q: ロールバック(R7.4)の単位は? → A: 版コミットと文書コミットを一緒に revert する。版コミットだけを revert すると `check` は緑だが、憲章・steering・README が Node 26 のまま残るため、その状態は正規のロールバックとして扱わない。
- Q: 憲章の版の上げ幅の基準は? → A: 意図した版上げ(判断の変更)は MINOR、実態への追随(強制された訂正)は PATCH とする。2.3.0(Python 3.14)は前者、2.3.1(uv 0.13)は後者。Node 26 は前者なので MINOR。この基準を Sync Impact Report に一行で書く。

### Session 2026-11-15 (`/sdd-analyze` の指摘 M-1「spec にない Dockerfile の変更」・M-5「merge commit の要件化」・M-6「NFR の追跡」の反映)

- Q: worker イメージの pnpm の入手経路の変更（`research.md` I-6: `node:26-slim` に corepack がない）は Scope に入りますか? → A: 入る。R6.4 を満たすのに必要な、Node 24 と 26 の両方で動く修正なので、R2.6 として要件にし、版コミットより前の独立したコミットにする（R7.1）。
- Q: merge commit でのマージは要件にしますか? → A: する（R7.6）。squash と rebase は C4 と C5 の境界を消し、R7.4 のロールバックを不能にする。
- Q: 非機能要件の追跡はどうしますか? → A: NFR-1〜NFR-4 に ID を付け、`traceability.md` の行とタスクの `_Traces:_` から参照する。

### Session 2026-11-15 (`/sdd-analyze` の指摘 H-1「spec.md を C0 に入れる」・H-2「憲章のサプライチェーン規定の要件化」の反映)

- Q: `spec.md` と SDD の成果物はどのコミットに入れますか? → A: C0 に入れる。`spec.md`、`spec.json`（design と tasks の承認後）、`plan.md`、`research.md`、`tasks.md`、`traceability.md` を C0 に含める。C1〜C5 が、コミット済みの要件（R2.6、R7.1、R7.6 を含む）を引いて実装できるようにするためである。C6 は検証の記録と完了印の更新だけを持つ。
- Q: 憲章 Additional Constraints「サプライチェーン」（ロック更新のダウングレード確認と、`pnpm audit` の出力そのものを PR 本文へ貼ること）は要件にしますか? → A: する（R6.8）。lockfile は `@types/node` の更新で変わる（依存の `undici-types` が 7.24.6 から 8.9.0 へ上がる。作業ツリーの差分で実測）ので、要約ではなく出力そのものを残す。

### Session 2026-11-15 (`/sdd-analyze` の指摘 M-1「後続コミットとロールバック」・M-2「spec の古い記述」の反映)

- Q: 事前検証の変更の所在の記述（上の「事前検証の結果」）は、worktree のままでよいですか? → A: 直す。worktree は存在せず、差分は主の作業ツリーにある。事実に合わせて 1 行を訂正した（要件の文面は変えていない）。
- Q: C4・C5 の対象ファイルを後から直すとき、R7.4 のロールバックはどう守りますか? → A: 修正を C6 以降の別コミットにしない。push 前なら C4 または C5 へ畳み、畳めないときは修正コミットも revert 対象に加える（`plan.md` Error Handling）。要件 R7.4 の文面は変えない。

## Success Criteria

- Node 26.13.1（`mise.toml` はメジャーのみの `"26"` なので、記録には実際に動かした版を書く）で `mise run check` が緑（件数を記録）、`mise run build` / `mise run size` が予算内、`mise run openapi:gen` で生成物に差分なし
- `apps/worker` のイメージが `node:26-slim` ベースで `docker build` に成功し、コンテナ内で worker の全モジュールが `DeprecationWarning` なしに読み込める
- Node 24 では worker ローダーの回帰テストが緑のまま（ロールバック可能性の確認）
- ローダー修正と版のピン変更が別コミットになっており、版コミットと文書コミットを一緒に revert すると Node 24 で `mise run check` が緑に戻る
- ベータレーンの記録(`next-agentic-stack` PR #77)が PR 本文からリンクされている
- PR 本文に `mise run audit` の出力そのものが貼られ、lockfile のダウングレード行が 0 件であることが検証の記録にある
- `specs/011-node-26-runtime-upgrade/` に plan・tasks・`traceability.md` があり、ADR がコードと同期している

## Scope

- In scope:
  - ランタイムのピン: `mise.toml` `[tools] node`、`apps/worker/Dockerfile` `ARG NODE_VERSION`、`apps/worker/package.json` `engines.node`
  - イメージの pnpm の入手経路: `apps/worker/Dockerfile` build 段の `corepack enable && corepack prepare` を `npm install --global pnpm@${PNPM_VERSION}` へ（`node:26-slim` が corepack を同梱しないため。`ARG PNPM_VERSION` の値は変えない）
  - 型: root と `apps/worker` の `@types/node` を 26 系へ、`.github/dependabot.yml` の hold を `>=27` へ、`tests/repo/dependabot.spec.ts` の `heldMajor` を 26 へ
  - 互換修正: `apps/worker/typescript-loader.mjs`（`mode: "strip"`）、`apps/worker/register-typescript-loader.mjs`（`registerHooks()`）、DEP0205 回帰テスト
  - ガバナンス: `.sdd/memory/constitution.md`（Node 24 LTS の記述）、`.sdd/steering/tech.md`、`docs/dependency-policy.md`（§7 の `@types/node 24` の記述、§8 のレーン表、§8.1 の据え置きの行を含む）
  - SDD の成果物: plan、tasks、`traceability.md`、worker ローダーの設計判断の ADR、憲章改正のレビュー記録
  - 記述: `README.md`、`AGENTS.md`、`CLAUDE.md`、`docs/cross-repo-adoption-backlog.md`、`docker-compose.yml` と worker 内のコメント。`apps/worker/Dockerfile` の冒頭の「`docker build` は sandbox で塞がれている」という NOTE は、R6.4・R6.5 で実測するので事実と合わなくなる。実測済みの趣旨へ書き換える
- Out of scope:
  - Python レーン（`services/agent`・`services/api`）の版上げ
  - ローカル firefox E2E の起動不具合（Node 24 でも再現する環境要因。E2E は CI の結果で判定）
  - pnpm・TypeScript など他ツールの版上げ、Node 27 以降
  - 実験的 API `stripTypeScriptTypes`（ExperimentalWarning）からの脱却や worker のビルド導入
  - worker ローダーを使わず Node 自身の型除去で動くスクリプト（`packages/rag` の ingest、`packages/db` の migrate、`packages/evals`）の個別検証。`eval-pr.yml` が Node 26 で pr-gate を通すことだけを間接的な確認とする（ingest と migrate は DB が要る）
  - CI への `docker build` ジョブの追加

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

要件の安定 ID: 受け入れ基準 `R.N`（例 1.1、6.7）は、`tasks.md`・`traceability.md` で `REQ-<R><NN>`（N を 2 桁にゼロ埋め。1.1 → `REQ-101`、6.7 → `REQ-607`）と書く。非機能要件は `NFR-1`〜`NFR-4`。

### Requirement 1: worker ローダーを Node 24 と 26 の両方で動かす

Node 26 では `stripTypeScriptTypes` の `mode: "transform"` が廃止され、`module.register()` が非推奨（DEP0205）になった。worker コンテナの起動経路はこの 2 つを通るため、版を上げる前にローダーを両方の版で動く形にする。

**Acceptance Criteria**

1.1 THE worker ローダー SHALL Node 24 系と Node 26 系のどちらでも、`@vaz/config/logger` と `apps/worker/src` の全モジュールを読み込み、終了コード 0 で終わる。
1.2 WHEN worker ローダーを Node 26 系で使う, THE worker ローダー SHALL stderr に `DeprecationWarning` を出さない。
1.3 THE worker ローダー SHALL 型除去だけでモジュールを変換し、型除去で扱えない構文をコード変換で受け入れない。
1.4 IF worker が読み込むソースに型除去で扱えない構文が含まれる, THEN THE リポジトリの typecheck SHALL それを型エラーとして検出する（`erasableSyntaxOnly`）。
1.5 THE worker ローダーの回帰テスト SHALL 1.2 を `--throw-deprecation` を付けた起動の終了コードで検査し、`register()` と `mode: "strip"` を組み合わせた修正前の登録方法では Node 26 系で失敗する(Red)ことを、実装時に確認して検証記録に残す。`main` のローダーは DEP0205 より前に `transform` で落ちるので、Red の証拠にしない。
1.6 WHEN 例外のスタックトレースを出す, THE worker SHALL 元のソースと同じ行番号・列番号を示す。回帰テストは、型注釈を含む行で throw する `.ts` を読み込み、行番号と列番号の両方を検査する。

### Requirement 2: 実行環境の Node を 26 LTS にする

**Acceptance Criteria**

2.1 THE 正本 SHALL Node のメジャーを 26 と宣言する。完全な版は固定しない（`node = "26"`）。そのため R6.7 の記録は、実際に動かした Node の版を残す。
2.2 THE `apps/worker/Dockerfile` SHALL 正本と同じメジャーの `node:<major>-slim` をビルド段と実行段の両方のベースイメージに使う。
2.3 THE `apps/worker/package.json` SHALL `engines.node` を `>=26` と宣言する。
2.4 WHEN CI のジョブが Node を用意する, THE CI SHALL 正本から版を読み、ワークフローの中に Node の版を別に書かない。repo ガードは「別の版指定がないこと」（`setup-node`・`node-version`・`NODE_VERSION`・`MISE_*` の環境変数・`jdx/mise-action` の `install_args` / `mise_toml` の不在）を検査する。「mise-action が `mise.toml` を読む」ことそのものは、アクションの仕様に依拠し、ガードは保証しない。
2.5 IF Dockerfile の `NODE_VERSION` が正本のメジャーと一致しない, THEN THE repo ガード（`tests/repo/container-toolchain-pins.spec.ts`）SHALL 失敗する。
2.6 THE `apps/worker/Dockerfile` SHALL build 段で pnpm を corepack に頼らずに用意する（`npm install --global pnpm@${PNPM_VERSION}`）。`ARG PNPM_VERSION` は root `package.json` の `packageManager` に追随したままとし、この修正は Node 24 と Node 26 のどちらのベースイメージでもビルドできる。

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
4.2 THE 憲章 SHALL Amendment procedure に従い、版の昇格、改訂履歴の行、Sync Impact Report を同じ変更で記録する。前例（2.3.0）にならい、新規コンテキストのレビューと人間承認を `specs/011-node-26-runtime-upgrade/reviews/` に残す。
4.3 THE 憲章の版の上げ幅 SHALL 宣言済み版の変更として MINOR とする（前例: 2.3.0 の Python 3.14 化）。THE Sync Impact Report SHALL 「意図した版上げは MINOR、実態への追随は PATCH」という基準を一行で書く（Clarifications 参照）。
4.4 THE `.sdd/steering/tech.md` の Constraints SHALL Node 26 LTS を宣言済みの版として示す。
4.5 THE `docs/dependency-policy.md` SHALL §8.1 の `@types/node` の行を 26 の据え置きに改め、§8 のベータレーン表から取り込み済みの Node 26 を外し、§7 の `(@types/node 24、…)` の記述を 26 に改める。THE §8.2 手順 2 SHALL 「行を削除する」に加えて、「据え置きを次のメジャーへ移す場合は行を書き換える」場合を示す。
4.6 THE 版を上げる PR SHALL `docs/dependency-policy.md` §8.2 の手順 1 が求める検証記録として、`next-agentic-stack` の `docs/beta-lane/2026-11-15-node-26.md`（PR #77、判定は部分解消）へのリンクを本文に持つ。ハブ文書からそのパスを書くときは、リンクではなくコードスパンにする（`doc-links.spec.ts`）。THE PR 本文 SHALL 残りの未解消事項（worker ローダーと Docker イメージ）を、本 spec の R1・R6 の結果で示す。

### Requirement 5: 利用者と agent 向けの記述を揃える

**Acceptance Criteria**

5.1 THE `README.md`（英語・日本語の両節）SHALL 前提とする Node を 26 LTS と示す。
5.2 THE `AGENTS.md` と `CLAUDE.md` SHALL `@types/node` の据え置きを 26（Node 26 LTS）として、同じ変更で揃えて示す。
5.3 THE `docker-compose.yml`、`apps/worker/Dockerfile`、`apps/worker/tsconfig.json`、`apps/worker/src/main.ts` のコメント SHALL worker の実行環境を Node 26 と示す。
5.4 THE `docs/cross-repo-adoption-backlog.md` SHALL 据え置きの記述を Node 26 に合わせる。
5.5 WHEN 変更が終わる, THE リポジトリ SHALL `specs/` 配下の過去の記録を除き、現行の版としての「Node 24」「`@types/node` 24」の記述を含まない（grep で確認する）。grep のコマンドと除外のパスは plan で固定する。除外してよいのは、日付付きの過去の記録の行（`docs/cross-repo-adoption-backlog.md` の X-15 の起票時の表の行）だけとし、現状を述べる行（同ファイルの「2026-10-07 時点」の記述）は更新する。
5.6 THE `specs/` 配下の過去 spec の記録 SHALL 書き換えない。

### Requirement 6: 品質ゲートとイメージで検証する

**Acceptance Criteria**

6.1 WHEN Node 26.13.1 で `mise run check` を実行する, THE リポジトリ SHALL 全段で成功し、テストの件数がベースライン（80 ファイル / 949 passed, 1 skipped）から減らない。
6.2 WHEN Node 26.13.1 で `mise run build` と `mise run size` を実行する, THE `apps/web` SHALL ビルドに成功し、`.size-limit.json` の上限（JS 420 kB / CSS 4.0 kB、brotli）を超えない。
6.3 WHEN Node 26.13.1 で `mise run openapi:gen` を実行する, THE 生成物 SHALL コミット済みのものとバイト単位で一致する。
6.4 WHEN ローカルの Docker（Rancher Desktop）で `apps/worker/Dockerfile` をビルドする, THE ビルド SHALL 成功する。
6.5 WHEN ビルドしたイメージのコンテナ内で、`CMD` の `src/start.ts`（DB と Inngest に接続しに行く）の代わりに、`node --import ./register-typescript-loader.mjs --input-type=module --eval` で `src/*.ts` の全モジュールを import する, THE コンテナ SHALL 終了コード 0 で終わり、stderr に `DeprecationWarning` を出さない。検査のコマンドは plan で固定する。
6.6 WHEN PR の CI が走る, THE CI SHALL 全ジョブ成功で終わる。E2E の合否はこの CI の結果で判定する。
6.7 THE 検証の記録 SHALL 各コマンド、実行した Node の版、結果の件数を残す。終了コードだけの記録は検証として扱わない。
6.8 WHEN `pnpm-lock.yaml` が変わる, THE 変更 SHALL コミット前に、削除行と追加行を対にして、同じパッケージの版が下がる行（ダウングレード行）が 0 件であることを確かめ、結果を検証の記録に残す。THE PR 本文 SHALL `mise run audit`（`pnpm audit --audit-level=moderate`）の出力そのものを貼る。「監査は通った」という要約は不可とする（憲章 Additional Constraints「サプライチェーン」）。

### Requirement 7: Node 24 へ戻せる形でコミットする

**Acceptance Criteria**

7.1 THE 変更 SHALL Requirement 1 のローダー修正と R2.6 の Dockerfile の pnpm 修正を、版コミットより前の、それぞれ独立したコミットにする。
7.2 THE 版コミット SHALL 正本と追随箇所（Requirement 2・3）の変更とロックファイルの更新だけを含む。Dockerfile では `ARG NODE_VERSION` の 1 行だけを変える。Dockerfile の Node の版に触れるコメント（5.3）は `ARG` に隣接しないので、文書コミットに含める。文書（Requirement 4・5）は、版コミットの後の別コミットにする。
7.3 WHEN ローダー修正のコミットだけを適用した状態（版は 24）で `mise run check` を実行する, THE リポジトリ SHALL 全段で成功する。
7.4 WHEN 版コミットと文書コミット（R4・R5）を一緒に revert する, THE リポジトリ SHALL Node 24 で `mise run check` が成功する状態に戻る。版コミットだけの revert は、憲章・steering・README が Node 26 のまま残るため、ロールバックの手順として扱わない。
7.5 THE 変更 SHALL 1 つの PR にまとめる（`docs/dependency-policy.md` §8.2「1 メジャーにつき 1 PR」）。
7.6 THE PR SHALL merge commit でマージし、squash と rebase を使わない。squash と rebase は版コミットと文書コミットの境界を消し、7.4 のロールバックを不能にする。THE PR 本文 SHALL この制約を示す。

### Requirement 8: SDD の成果物をコードと同期させる

**Acceptance Criteria**

8.1 THE `specs/011-node-26-runtime-upgrade/` SHALL plan、tasks、`traceability.md` を持ち、各 Requirement を実装・テスト・記録へ対応づける。
8.2 THE リポジトリ SHALL worker ローダーの設計判断（実験的な `stripTypeScriptTypes` の `mode: "strip"`、`registerHooks()` の採用、`erasableSyntaxOnly` による保護、Node 24 と 26 の両対応）を ADR に記録する。
8.3 THE plan SHALL gap-analysis §6 の要調査事項（`registerHooks()` の安定度、DEP0205 の単独再現、`erasableSyntaxOnly` の適用範囲、Node 26 の semver-major の影響、検証コマンド）の結果を記録する。
8.4 THE 変更 SHALL 関係のない差分（`apps/web/AGENTS.md` の見出しの変更）を含めない。THE 実装ブランチ SHALL 変更内容を表す名前にし（例: `chore/node-26-runtime`）、マージ済みの `chore/dependency-security-refresh` を再利用しない。

## Non-Functional Requirements

- NFR-1 互換性: worker ローダーは Node 24 系・26 系の両方で動く（Requirement 1、7）。
- NFR-2 サイズ: client バンドルは brotli で JS 420 kB / CSS 4.0 kB 以内。上限は引き上げない。
- NFR-3 セキュリティ: `pnpm audit --audit-level=moderate` で新しい指摘を増やさない。全履歴の secret scan で検出 0 件を保つ。
- NFR-4 再現性: Node の版はワークフロー・Dockerfile・ドキュメントで正本以外に独立して決めない。正本は major のみなので、検証の記録には実際に動かした版を残す。

`traceability.md` は NFR を `NFR-1`〜`NFR-4` の ID で追跡する（`REQ-` の ID 体系の外）。

## Out of Scope / Future Work

- 実験的 API `stripTypeScriptTypes` からの脱却（Node が型除去を安定 API にしたとき、または worker にビルドを導入するときに再検討する）
- CI に `docker build` と全モジュール読み込みのジョブを足す（ガードとして恒久的だが、`tests/repo/ci-workflows.spec.ts` の SHA pin と `permissions:` の検査も満たす必要がある）
- docker compose で Inngest Connect に接続した worker の実走
- Python レーン、pnpm、TypeScript の版上げ。Node 27 以降

---

_Initialized: 2026-11-15T14:32:03+0900_
