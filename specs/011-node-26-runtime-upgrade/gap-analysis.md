# 011-node-26-runtime-upgrade — 実装ギャップ分析

_Analyzed: 2026-11-15 / base `main` 04215a2 / 事前検証 worktree `vaz-agentic-ai-next-node26`（未コミット）_

## 1. 分析サマリー

- **R1〜R3（コードとピン）は、ほぼ worktree で揃っている**。ローダーの両対応（`registerHooks()` と `mode: "strip"`）は、Node 24.22.3 と 26.13.1 の両方で worker の `src` の全 7 モジュールを読み込み、`DeprecationWarning` を出さないことを実測した。行番号も保たれている。足りないのは、全モジュール読み込みの回帰テストと、R1.5 の Red の証拠（旧方式が DEP0205 で落ちる）。
- **R4・R5（ガバナンスと記述）は全部が未着手**。対象は spec が挙げた箇所に加えて `docs/dependency-policy.md:198`（§7）。憲章の改正では、MINOR か PATCH か（2.3.0 と 2.3.1 で扱いが分かれている）と、前例にあるレビュー記録の要否を決める必要がある。
- **最大の外部ギャップは R4.6**。§8.2 が求めるベータレーンの Node 26 の記録が、`next-agentic-stack` にない（待機中トリガーは発火済みで、未記録）。別リポジトリに記録するか、ハブ側で代えるかを決める必要がある。
- **R6.4・6.5（イメージの検証）は、実施できる環境がまだない**。ローカルの Docker デーモンは停止中で、CI にもイメージをビルドするジョブがない。
- **推奨は案 A（worktree の拡張）か案 C（ローダーのコミットだけ TDD でやり直す）**。どちらでも新しいブランチを切る（worktree のブランチ名はマージ済みの #201 と同じ）。`apps/web/AGENTS.md` の関係のない差分は除外する。

## 2. 調査範囲と方法

- 比較の基準: `main`（`04215a2`）と事前検証 worktree `/Users/Shared/codes/vaz-agentic-ai-next-node26`（同じ base、11 ファイルが未コミット）。
- 読んだもの: spec.md / spec.json、`.sdd/steering/{product,structure,tech}.md`、憲章、`docs/dependency-policy.md` §7・§8、`apps/worker` のローダー・Dockerfile・tsconfig・テスト、`tests/repo/{container-toolchain-pins,dependabot}.spec.ts`、`.github/workflows/*.yml`、ベータレーン `next-agentic-stack`（`652fefc`）の `docs/beta-lane/` と spec `001-hub-beta-lane`。
- 実測（2026-11-15、mise の `node@24` = v24.22.3、`node@26` = v26.13.1）:

| 検査 | Node 24 | Node 26 |
|---|---|---|
| worktree ローダーで `@vaz/config/logger` + `src/audit` を読み込む | `loaded`、exit 0 | `loaded`、exit 0 |
| worktree ローダーで `apps/worker/src/*.ts` 全 7 ファイルを読み込む | `all-loaded`、exit 0 | `all-loaded`、exit 0 |
| 上の 2 つの stderr | `ExperimentalWarning: stripTypeScriptTypes` のみ | 同左（`DeprecationWarning` なし） |
| `main` のローダー（`register()` + `mode: "transform"`）| （未実行） | `triggerUncaughtException` で異常終了 |
| 4 行目で throw する `.ts` のスタック行番号（worktree ローダー）| `t.ts:4` | `t.ts:4` |

- 未実施: `register()` と `mode: "strip"` を組み合わせた Node 26 での DEP0205 の単独再現（スクラッチ領域の準備コマンドが権限で拒否された）。Docker デーモンが動いていない（Rancher Desktop の `docker.sock` がない）ため、イメージのビルドもしていない。
- 外部調査: Node 26 の semver-major のうち、`--experimental-transform-types` の削除と `module.register()` の実行時非推奨化は二次情報で確認できた（下記「出典」）。`registerHooks()` の安定度は確認できていない。

## 3. 要件別ギャップ

凡例: ✅ worktree に実装済みで実測済み / 🔧 worktree に一部あり、追加が要る / 🆕 どこにもない（`main` にもない）

### Requirement 1: worker ローダーの Node 24/26 両対応

| AC | 判定 | 根拠・ギャップ |
|---|---|---|
| 1.1 | 🔧 | worktree の `registerHooks()` と `mode: "strip"` で、両方の版で全モジュールを読み込めた（§2）。ただし回帰テスト `apps/worker/tests/typescript-loader.spec.ts` が読むのは `@vaz/config/logger` と `./src/audit` だけで、「`src` の全モジュール」をテストとして固定していない。`src/start.ts` は `import.meta.main` で起動を守っているので、全ファイルを import するテストにできる |
| 1.2 | ✅ | worktree のテストに `expect(result.stderr).not.toContain("DeprecationWarning")` を追加済み。Node 26 で実測済み |
| 1.3 | ✅ | worktree の `typescript-loader.mjs` は `mode: "strip"` だけを使う。`transform` は Node 26 では受け付けない |
| 1.4 | ✅ | `packages/config/tsconfig.base.json:14` に `"erasableSyntaxOnly": true`。`apps/worker/tsconfig.json` は `extends` で継承する。ただし worker が読み込む `@vaz/*` パッケージは per-package tsconfig を持たず、root の typecheck の対象に含まれるかを plan で確認する（§6-3） |
| 1.5 | 🔧 | 「修正前の登録方法では Node 26 で失敗する」ことを確認した記録がまだない。`main` のローダーは DEP0205 より前に `transform` の `ERR_INVALID_ARG_VALUE` で落ちるので、`DeprecationWarning` の検査が有効だという証拠にならない。`register()` と `strip` を組み合わせた中間状態で Red を確認し、PDCA に記録する必要がある |
| 1.6 | ✅ | strip モードは型を空白に置き換えるだけなので、行番号は変わらない（実測 `t.ts:4`）。source map を外す根拠になる。列番号の実測はまだなく、テストもない（追加するかは任意） |

### Requirement 2: 実行環境の Node 26 化

| AC | 判定 | 根拠・ギャップ |
|---|---|---|
| 2.1 | ✅ | worktree の `mise.toml`: `node = "26"` |
| 2.2 | ✅ | worktree の `apps/worker/Dockerfile`: `ARG NODE_VERSION=26`。build 段と runtime 段は同じ ARG を使う |
| 2.3 | ✅ | worktree の `apps/worker/package.json`: `"node": ">=26"`。root の `package.json` は `engines` を持たない（spec も求めていない） |
| 2.4 | ✅ | 全ワークフローが `jdx/mise-action`（v5.2.7、SHA pin）で Node を用意する。`setup-node` も `node-version` もない（grep で 0 件）。**変更は要らない**。ただし「ワークフローに Node の版を書かない」ことを検査するガードもない（任意で追加できる） |
| 2.5 | ✅ | 既存の `tests/repo/container-toolchain-pins.spec.ts`（`NODE_VERSION equals the mise.toml [tools] node major`）で満たす。`main` のまま Node だけを上げると落ちることは spec の事前検証で確認済み |

### Requirement 3: 型定義と Dependabot

| AC | 判定 | 根拠・ギャップ |
|---|---|---|
| 3.1 | ✅ | worktree の root と `apps/worker` が `^26.6.6`。lockfile の peer 解決（`vite` / `vitest` / `next` / `next-auth` / `inngest`）も `@types/node@26.6.6` になっている |
| 3.2 | ✅ | worktree の `.github/dependabot.yml`: `versions: [">=27"]`（26 系の minor/patch は止めない） |
| 3.3 | ✅ | worktree の `tests/repo/dependabot.spec.ts`: `heldMajor: 26` |
| 3.4 | ✅ | worktree のコメント: `(26 LTS)` |

### Requirement 4: 憲章とガバナンス文書

| AC | 判定 | 根拠・ギャップ |
|---|---|---|
| 4.1 | 🆕 | `.sdd/memory/constitution.md:271` は「Node 24 LTS と uv 0.13 系は `mise.toml`…」のまま |
| 4.2 | 🆕 | Sync Impact Report（ファイル先頭のコメント。今は 2.2.0→2.3.0 の内容で、2.3.1 は反映されていない）、改訂履歴の行、末尾の `**Version**` / `**Last amended**` を更新する。前例の 2.3.0 では `specs/009-…/reviews/python314-constitution-r1.md` に**新規コンテキストのレビューと人間承認**を残している。この記録は spec に書かれていない（§4-2） |
| 4.3 | 🔧 | spec は MINOR（前例 2.3.0）とする。ただし直近の 2.3.1（uv 0.12→0.13）は「実態に合わせた訂正」として **PATCH** で扱った。Versioning policy では MINOR は「原則・節の追加、または実質的な拡張」なので、版の変更が MINOR なのか PATCH なのかは文面からは決まらない。plan で根拠を明記する（§4-3） |
| 4.4 | 🆕 | `.sdd/steering/tech.md:65` は「Node 24 LTS」のまま |
| 4.5 | 🔧 | §8.1 の行（`docs/dependency-policy.md:233`）と §8 のレーン表（「Node 26」）を直す。spec に書かれていない箇所がもう 1 つある: §7「保留中メジャーとの整合」の `(@types/node 24、…)`（同 `:198`）。また §8.2 の手順 2 は「8.1 の表の該当行（削除）」「`HELD_BACK` の該当行を削除」と書くが、spec は行を**書き換えて** 26 で据え置く。手順の文面とずれる（§4-4） |
| 4.6 | 🆕 | **ベータレーンの記録がない**。`next-agentic-stack` は `mise.toml` で `node = "26.13.1"` だが、`docs/beta-lane/` に Node 26 の記録ファイルはない。待機中トリガー表（`docs/beta-lane/README.md:25`、「Node 26 Active LTS」）は発火条件を満たしている（26.13.0 から LTS）が、未記録のまま。TEMPLATE.md:52 は hub-equivalent の条件・変更点の全一覧・hub gate の結果を求めている（§4-1） |

### Requirement 5: 利用者と agent 向けの記述

| AC | 判定 | 根拠・ギャップ |
|---|---|---|
| 5.1 | 🆕 | `README.md:33,37,40`（英語）、`:216,219`（日本語） |
| 5.2 | 🆕 | `AGENTS.md:71`、`CLAUDE.md:60` |
| 5.3 | 🔧 | Dockerfile のコメントは worktree で修正済み。`docker-compose.yml:86`、`apps/worker/tsconfig.json:2`、`apps/worker/src/main.ts:18` は未修正 |
| 5.4 | 🆕 | `docs/cross-repo-adoption-backlog.md:112`（「2026-10-07 時点: `@types/node` 24」）。`:59`（X-15 の起票時の記録）は過去の記録として残すのか更新するのかを決める必要がある（§4-5） |
| 5.5 | 🆕 | grep の現時点の残り（`specs/` を除く）: 上の各ファイルと `docs/dependency-policy.md:198,233`。終了条件を確かめるには、「過去の記録」とする行の許可リストを決めておく必要がある |
| 5.6 | ✅ | 守るべき制約で、実装は要らない。`specs/001`、`005`、`007`、`009`、`inherited/` に Node 24 の記述があるが、触らない |

### Requirement 6: 品質ゲートとイメージ

| AC | 判定 | 根拠・ギャップ |
|---|---|---|
| 6.1 | 🔧 | worktree で記録済み（80 ファイル / 949 passed, 1 skipped）。コミットを分けたあと、各コミットで取り直す |
| 6.2 | 🔧 | worktree で予算内。数値は PDCA に記録する |
| 6.3 | 🔧 | worktree で差分なし。コミット後に取り直す |
| 6.4 | 🆕 | **実施できる環境がない**。ローカルの Docker デーモンは停止中で、CI にはイメージをビルドするジョブがない（`.github/workflows/` の `docker` は `tests.yml:67` のコメント 1 件だけ）。spec の「Docker のある環境か CI で実施」は、今はどちらも用意されていない（§4-6） |
| 6.5 | 🆕 | 6.4 と同じ。検査のコマンド（たとえば `docker run --rm <img> node --import ./register-typescript-loader.mjs --eval '<全 src を import>'`）もまだ決まっていない。`CMD` の `src/start.ts` は DB や Inngest に接続しに行くので、そのままでは使えない |
| 6.6 | 🆕 | PR がまだない。E2E（Playwright）と `eval-pr.yml` が Node 26 で走るのは CI が初めて |
| 6.7 | 🔧 | 事前検証の記録は spec.md にあるが、Node の版ごとのコマンドと件数の表がない。`pdca/` にまとめる |

### Requirement 7: revert できるコミット構成

| AC | 判定 | 根拠・ギャップ |
|---|---|---|
| 7.1 | 🆕 | worktree は全部が未コミットで、ブランチ名 `chore/dependency-security-refresh` は**マージ済みの PR #201 と同じ名前**。新しいブランチ（例: `chore/node-26-runtime`）を切って、ローダーの 3 ファイルを最初のコミットにする |
| 7.2 | 🔧 | 版コミットに入れるのは `mise.toml`、Dockerfile の `ARG`、`apps/worker/package.json`、root の `package.json`、`pnpm-lock.yaml`、`.github/dependabot.yml`、`tests/repo/dependabot.spec.ts`。Dockerfile のコメント（R5.3）をどちらのコミットに入れるかは決まっていない（§4-7） |
| 7.3 | 🔧 | ローダーは Node 24 で動くことを実測した（§2）。ローダーのコミットだけを当てた状態で `mise run check` を Node 24 で走らせるのは未実施 |
| 7.4 | 🆕 | 版コミットを revert したあとの `check` は未実施。ドキュメントのコミット（R4・R5）が残ったまま revert すると、文書は 26 で実体は 24 になる（§4-7） |
| 7.5 | ✅ | 守るべき制約（1 PR） |

**関係のない差分**: `apps/web/AGENTS.md` の見出しの変更（`#` → `##`）が `main` と worktree の両方で未コミットのまま残っている。本 spec のコミットに混ぜない。

## 4. 統合上の課題

1. **ベータレーンの記録（R4.6 が依存する）**: `docs/dependency-policy.md` §8.2 の手順 1 は、記録を「ベータレーン側」に置くよう求めている。今回の事前検証はハブの worktree で行ったので、`next-agentic-stack` に記録がない。取れる道は 2 つ。(a) `next-agentic-stack` に `docs/beta-lane/2026-11-xx-node26.md` を TEMPLATE に沿って追加する。別リポジトリへの PR になる。(b) ハブ側の記録（本 spec の `pdca/`）で代える。§8.2 からの逸脱になるので、その理由を本文に書く。(a) を選ぶ場合、spec `001-hub-beta-lane` の R4 が求める `playwright` を含む 4 ゲートも、ベータレーンで通す必要がある。ハブ文書からは兄弟リポジトリのパスをコードスパンで書く（`doc-links.spec.ts`）。
2. **憲章改正のレビュー記録**: 前例の 2.3.0 は新規コンテキストのレビューと人間承認を `reviews/` に残した。R4.2 の「Amendment procedure に従う」の中にこれが入るのかを、plan で明示する。
3. **MINOR か PATCH か**: 2.3.0（Python 3.13→3.14）は MINOR、2.3.1（uv 0.12→0.13）は PATCH。どちらも宣言済みの版の変更で、違いは「判断の変更（意図した版上げ）か、実態への追随（強制された修正）か」にある。Node 26 は意図した版上げなので 2.3.0 に近いが、判断基準を Sync Impact Report に一行書いておかないと、次の版上げでまた揺れる。
4. **dependency-policy §8.2 の文面と、据え置きの継続**: 手順 2 は「行を削除」を前提にしている（据え置きの解除）。今回は「24 の据え置き → 26 の据え置き」への移行なので、削除ではなく書き換えになる。§8.2 に「据え置きを次のメジャーへ移す場合」を加えるか、本 PR の説明で済ませるかを決める。§7 の 198 行目も同じ PR で直す。
5. **5.5 の grep の許可範囲**: `docs/cross-repo-adoption-backlog.md:59`（X-15 の起票時の内容）は「当時の据え置き」を記述した表の行で、§112 は「2026-10-07 時点」という日付付きの現状である。どちらを「過去の記録」として扱うかを決め、grep コマンドと除外のパスを plan に固定する。
6. **イメージ検証の環境（R6.4・6.5）**: Docker デーモンが動いていない。選択肢は次の 3 つ。(a) Rancher Desktop を起動してローカルでビルドする（いちばん安い）。(b) CI に `docker build` ジョブを足す（ガードとしては恒久的だが、スコープが広がり、`tests/repo/ci-workflows.spec.ts` の SHA pin や `permissions:` の検査も満たす必要がある）。(c) 一時的な workflow_dispatch のジョブ。spec は CI のジョブ追加を求めていないので、(a) が基本線になる。検査のコマンドは、DB に接続する `start.ts` を避け、`src/*.ts` を全部 import する `--eval` を `CMD` の代わりに渡す。
7. **コミットの境界と revert**: R7.2 は版コミットを「ピンとロックファイルだけ」に絞るので、R4・R5 の文書は 3 本目のコミットになる。版コミットだけを revert すると、文書（憲章・steering・README）が 26 のまま残る。repo ガードは文書の Node の版を検査しないので `check` は緑になる（7.4 は満たす）が、憲章の正本の記述と `mise.toml` がずれる。ロールバックの手順として「版コミットと文書のコミットを一緒に revert する」と plan に書くか、R7.4 の想定どおり版コミットだけを revert する運用でよいとするかを決める。Dockerfile のコメント（26）は版コミットに含めるのが自然（ARG と同じ行の近くにあり、revert で一緒に戻る）。
8. **ネイティブの型除去で動くスクリプト**: `packages/rag`（`node bin/ingest.ts`）、`packages/db`（`node bin/migrate.ts`）、`packages/evals`（`node src/nightly.ts` / `pr-gate.ts`）は worker ローダーを使わず、Node 自身の型除去で動く。`check` はこれらのエントリポイントを実行しない。CI の `eval-pr.yml` が Node 26 で pr-gate を通すことが、間接的な検証になる。ingest と migrate は DB が要るので、R6 の範囲では検証されない。Out of scope にするか、`node --check` 相当の読み込みだけを検査に加えるかを決める。
9. **実験的 API の継続**: `stripTypeScriptTypes` は Node 24・26 のどちらでも `ExperimentalWarning` を出す。R1.2 は `DeprecationWarning` だけを検査するので通るが、Node 27 以降で API が変わるリスクは残る。spec の Out of Scope に書かれているとおり、今回は扱わない。
10. **`registerHooks()` の安定度**: 同期フックをメインスレッドで動かすので、`load` の中で非同期 I/O ができない（worktree は `readFileSync` に変更済み）。Node 24 と 26 での stability index と、将来の変更のリスクは公式ドキュメントでまだ確かめていない（§6-1）。

## 5. 実装アプローチの選択肢

| 案 | 内容 | コスト | リスク | 向いている場合 |
|---|---|---|---|---|
| **A. worktree を土台に拡張（Extend）** | worktree の 11 ファイルの差分を、新しいブランチで 3 コミット（ローダー → 版 → 文書）に分ける。足りないもの（全モジュールのテスト、1.5 の Red の記録、R4・R5 の文書、イメージの検証）を加える | 低 | worktree の未コミットの状態に頼る（消えるとやり直し）。関係のない `apps/web/AGENTS.md` が混ざりやすい | spec の Clarification（「事前検証の worktree 変更を土台にする」）どおり。**第一候補** |
| B. main から作り直す（Build new） | `main` で新しいブランチを切り、TDD で Red（Node 26 でテストが落ちる）→ Green を最初から踏む。worktree は参考にとどめる | 中 | 同じ差分を二度書く。ただし原則 9（テストを先に書く）と R1.5 の Red の証拠が自然に残る | Red の記録の厳密さを優先する場合 |
| C. ハイブリッド | ローダーのコミットだけを B で作る（Red の記録のため。テストの追加を先にコミットし、Node 26 で落ちることを確かめる）。版と文書のコミットは worktree の差分を流用する | 低〜中 | 2 つの方法の継ぎ目でミスが出やすい（lockfile の再生成を忘れるなど） | 1.5 と原則 9 を満たしつつ、機械的な差分は再利用したい場合 |

ベータレーンの記録（§4-1）は案とは独立に決める。(a) 兄弟リポジトリに記録する、(b) ハブ側の記録で代える、のどちらでも A〜C と組み合わせられる。

## 6. plan フェーズで要調査の事項

1. **`module.registerHooks()` の安定度**: Node 24.22 と 26.13 の公式 API ドキュメントで stability index を確かめる。将来のメジャーで削除や変更が予告されていないか。同期フックによる制約（`load` で非同期 I/O ができない）が worker の将来の要件と衝突しないか。
2. **DEP0205 の単独再現**: `register()` + `mode: "strip"` の組み合わせで、Node 26 では `DeprecationWarning` が出て、Node 24 では出ないことを確かめる。これを R1.5 の Red の証拠として `pdca/` に残す。
3. **`erasableSyntaxOnly` の適用範囲**: worker が読み込む `@vaz/*` の source（`config`、`schemas`、`db`、`agents`、`tools`、`rag`）が、どの tsconfig の typecheck に入るか。`pnpm -r run typecheck` と `apps/worker/tsconfig.json` の `include: ["src"]` で、依存先のソースまで型検査がかかるか（import をたどるので、かかるはず）を確かめる。
4. **Node 26 の semver-major の影響を洗い出す**: 公式 v26.0.0 のリリースノートの breaking changes（stream の旧モジュール、`writeHeader` の削除、Temporal のデフォルト有効化など）を、リポジトリの直接の利用箇所と照合する。事前検証の `check` が緑なので影響は小さいと見られるが、テストが通らない経路（`ingest` / `migrate` / worker の `start.ts`）は別に確かめる。
5. **イメージの検証コマンド**: `docker build -f apps/worker/Dockerfile .` と、DB に接続しない全モジュール読み込みのコマンドを決める。Rancher Desktop で `node:26-slim` を pull できるか（ネットワークの FLAG。Dockerfile の NOTE は sandbox で build が塞がれていた過去を書いている）。
6. **ベータレーンの記録の置き場所と書式**: `next-agentic-stack` の TEMPLATE.md と spec `001-hub-beta-lane` の R4 の要求（`typecheck`・`vitest`・`build`・`playwright`）を満たす記録を作るか、ハブ側で代えるか。代える場合の §8.2 の扱い。
7. **憲章の版の上げ幅と、レビューの記録**: MINOR と PATCH の判断基準（§4-3）。2.3.0 の `reviews/python314-constitution-r1.md` と同じ形式のレビュー記録を作るか。

### 出典

- [Node.js 26 LTS: Temporal API on by default, 5 breaking changes (byteiota)](https://byteiota.com/node-js-26-lts-temporal-api-on-by-default-5-breaking-changes/)
- [Node.js 26 LTS – what breaks (jonathansblog)](https://jonathansblog.co.uk/nodejs-26-lts-temporal-api-what-breaks)
- [Node.js v26.0.0 release (nodejs.org)](https://nodejs.org/ko/blog/release/v26.0.0)
- [Node.js deprecations (r2.nodejs.org)](https://r2.nodejs.org/docs/latest/api/deprecations.html)
- [Node.js 26.x versions (versionlog)](https://versionlog.com/nodejs/26/)

いずれも 2026-11-15 に検索した。`--experimental-transform-types` の削除と `module.register()` の実行時非推奨化は、二次情報と §2 の実測で裏付けた。DEP0205 の番号と `registerHooks()` の安定度は、公式ドキュメントでまだ照合していない（§6-1）。
