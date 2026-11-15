# 011-node-26-runtime-upgrade — Discovery & Research Log

`/sdd-plan` で作成した。gap-analysis §6 の要調査事項（R8.3）の結果と、設計判断の根拠を記録する。
実測はすべて 2026-11-15、macOS、mise の `node@24` = v24.22.3、`node@26` = v26.13.1、
Docker は Rancher Desktop（client 29.9.3-rd / server 29.9.2）で行った。

## Discovery type

Extension (light)。既存の worker ローダー、版のピン、ガバナンス文書を対象にした版上げで、新しい
サブシステムも第三者依存も足さない。ただし I-6（corepack）で Dockerfile の変更が 1 行増えた。

## 着手時点の状態

- spec と gap-analysis が前提にした worktree `/Users/Shared/codes/vaz-agentic-ai-next-node26` は、もう存在しない
  （`git worktree list` は主作業ツリーだけを返す）。同じ 11 ファイルの差分は、主作業ツリーのブランチ
  `chore/011-node-26-runtime-upgrade`（`af8e730`、`origin` に push 済み）に未コミットで残っている。
- ブランチ名は R8.4 の条件（変更内容を表す名前。`chore/dependency-security-refresh` を使い回さない）を満たす。
- `apps/web/AGENTS.md` の見出しの差分（`#` → `##`）は未コミットのまま残っている。本 spec のコミットに入れない（R8.4）。

## Investigations

### I-1: `module.registerHooks()` の安定度（gap-analysis §6-1）

- **Question**: `registerHooks()` は Node 24 と 26 でどの安定度か。将来の削除や変更は予告されているか。
- **Findings**:
  - v23.5.0 / v22.15.0 で追加された。v24.x と v26.x のどちらの文書でも「Stability: 1.2 - Release candidate」。
    v24.13.1 / v25.4.0 で release candidate になった（"Synchronous and in-thread hooks are now release candidate."）。
  - 文書は同期フックを推奨している（"it's recommended to use synchronous hooks via module.registerHooks() for simplicity."）。
    削除や変更の予告はない。
  - 制約: 同期フックは worker thread に既定では引き継がれない。`--import` / `--require` で読み込んだファイルから
    登録した場合は引き継がれる。本リポジトリの登録は `--import ./register-typescript-loader.mjs` なので該当する。
    `apps/worker/src` は worker thread を使っていない。
  - 同期フックなので `load` の中で非同期 I/O はできない。ローダーは `readFileSync` を使う。読むのは起動時の
    ローカルファイルだけなので、要件と衝突しない。
- **Evidence**: `https://nodejs.org/docs/latest-v24.x/api/module.html`、`https://nodejs.org/docs/latest-v26.x/api/module.html`。
  実測は I-2 と I-4（両方の版で 7 モジュールを読み込めた）。
- **未確認**: 文書の customization hooks の節は取得が途中で切れた。上記以外の注意書きは読めていない。

### I-2: DEP0205 の単独再現（gap-analysis §6-2、R1.5）

- **Question**: `register()` と `mode: "strip"` を組み合わせた登録方法は、Node 26 で `DeprecationWarning` を出し、Node 24 では出さないか。
- **Findings**: 出す。`--throw-deprecation` を付けると、終了コードで判別できる。

  | 登録方法 | Node 24.22.3 | Node 26.13.1 |
  |---|---|---|
  | `register()` + `strip`（フラグなし） | exit 0。stderr は `ExperimentalWarning` のみ | exit 0。stderr に ``[DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.`` |
  | `register()` + `strip` + `--throw-deprecation` | **exit 0** | **exit 1**（`code: 'DEP0205'`、`register-old.mjs:2:1` で throw） |
  | `registerHooks()` + `strip` + `--throw-deprecation`（現在の作業ツリー） | exit 0、`all-loaded 7` | exit 0、`all-loaded 7` |
  | `register()` + `transform`（`main` のローダー） | exit 0 | `ERR_INVALID_ARG_VALUE`（`options.mode` は `'strip'` のみ） |

  `main` のローダーは DEP0205 より前に `transform` で落ちる。R1.5 が Red の証拠にしないとしている理由を実測で確かめた。
- **Evidence**: スクラッチ領域の `register-old.mjs` / `loader-async.mjs` を両方の版で実行した。公式の分類は
  v24 が "Documentation-only"（v24.15.0 から）、v26 が "Runtime"（v26.0.0、PR #62401）で、
  "`module.register()` will be removed in a future version of Node.js." と書かれている
  （`https://nodejs.org/docs/latest-v26.x/api/deprecations.html#dep0205-moduleregister`）。
- **設計への反映**: 回帰テストは `--throw-deprecation` を付けて起動し、終了コードを検査する（R1.5）。Red の確認は
  実装時に、リポジトリのテストでもう一度行う（plan「検証手順」V-1）。
- **追補（`/sdd-analyze` の指摘 H-1「テストより先に実装が入る順序」のための実測、2026-11-15）**: 上の表は `register()` + `strip` と `registerHooks()` を比べたもの。テスト先行の順序を決めるため、
  (0) `main` のローダー（`transform` + `register()`）と、(a) 同期の strip 版ローダー + `register()` も測った。
  - (0) Node 24.22.3: 型除去で扱えない `enum` を**受け入れる**（`transform` が変換する）。スタックの先頭が `throws.ts:4:11`（フィクスチャの 2 行目で throw）で行がずれる。
    つまり L-3（1.3）と L-4（1.6）は、`main` のローダーに対して Node 24 でも Red になる。Node 26.13.1: `ERR_INVALID_ARG_VALUE`（`options.mode` は `'strip'` のみ）。
  - (a) 同期の strip 版ローダー + `register()` + `--throw-deprecation`: Node 24 は値が読め、Node 26 は `code: 'DEP0205'` を出す。同期関数でも `register()` は受け付ける。
    したがって、ローダーを先に strip・同期版にし、登録を後から `registerHooks()` へ移す 2 段の実装で、R1.5 の Red を自然な状態として得られる（一時的な改変は (b) だけ）。

### I-3: `erasableSyntaxOnly` の適用範囲（gap-analysis §6-3、R1.4）

- **Question**: worker が実行時に読み込む `.ts` は、すべて `erasableSyntaxOnly` 付きの typecheck の対象か。
- **Findings**:
  - `packages/config/tsconfig.base.json:14` が `"erasableSyntaxOnly": true`。`apps/worker/tsconfig.json` と
    `apps/web/tsconfig.json` はどちらもこれを `extends` し、上書きしていない。
  - `apps/worker` の `tsc --noEmit --listFilesOnly` が含む first-party の `.ts` は 31 ファイル
    （`apps/worker` 7、`packages/agents` 6、`config` 3、`db` 1、`rag` 3、`schemas` 7、`tools` 4）。
  - Node 26 で `src/*.ts` を全部 import したとき、ローダーが実際に読んだ `.ts` は 23 ファイル
    （`apps/worker` 7、`agents` 3、`config` 3、`db` 1、`rag` 3、`schemas` 6）。**23 ファイルすべてが tsc の 31 ファイルに含まれる**
    （差集合は空）。型だけの import は実行時に消えるので、実行時の集合は tsc の集合より小さい。
  - `packages/*/src` と `apps/worker/src` に enum、namespace、パラメータプロパティはない（grep で 0 件）。
  - `packages/evals` の typecheck は `--ignoreConfig` で `erasableSyntaxOnly` を付けていない。worker は `@vaz/evals` を
    読み込まないので、R1.4 の範囲の外。
- **Evidence**: ローダーを包んで読み込んだ URL を記録する `register-trace.mjs`（スクラッチ）の出力と、
  `pnpm exec tsc --noEmit --listFilesOnly` の出力を `comm -23` で比べた。
- **設計への反映**: 設定が消えても、enum が入るまではどのゲートも落ちない。そのため repo ガードで設定そのものを固定する
  （plan DES-1.2）。

### I-4: 行番号と列番号、型除去で扱えない構文（R1.3、R1.6）

- **Question**: strip モードは行と列を保つか。型除去で扱えない構文をどう扱うか。
- **Findings**:

  | 検査 | Node 24.22.3 | Node 26.13.1 |
  |---|---|---|
  | 4 行目（型注釈あり）で throw する `.ts` のスタック。期待値は `4:104`（`new Error` の位置） | `4:104` | `4:104` |
  | 同じファイルを `main` のローダー（`transform` + `sourceMap`、`--enable-source-maps` なし）で読む | `4:11`（列がずれる。次のフレームは 6 行目で、行もずれる） | 起動できない |
  | 同上に `--enable-source-maps` を付ける | `4:104` | — |
  | `enum` を含む `.ts` を現在のローダーで読む | exit 1、`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`（"TypeScript enum is not supported in strip-only mode"） | 同左 |

  `main` の Dockerfile の `CMD` は `--enable-source-maps` を付けていない。つまり `main` の worker は、スタックの位置が
  ずれた状態で動いていた。strip モードはこのずれをなくす。
- **Evidence**: スクラッチの `throws.ts` / `enum.ts` を両方の版で実行した。
- **設計への反映**: 1.6 のテストは、行と列の期待値をフィクスチャの文字列から計算する（整形で列が変わっても壊れない）。
  1.3 のテストは、`enum` のフィクスチャが `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` で拒否されることを検査する。

### I-5: Node 26 の semver-major の影響（gap-analysis §6-4）

- **Question**: v26.0.0 の破壊的変更のうち、本リポジトリが直接当たるものはどれか。
- **Findings**:

  | 変更（v26.0.0） | 本リポジトリへの影響 |
  |---|---|
  | `stripTypeScriptTypes` の `transform` と `sourceMap` を削除、`--experimental-transform-types` を削除（#61803） | **当たる**。worker ローダーを `strip` へ移す（R1） |
  | `module.register()` を実行時非推奨に（DEP0205、#62401） | **当たる**。`registerHooks()` へ移す（R1） |
  | Corepack を同梱しない（v25.0.0、#57617 / #59835） | **当たる**。I-6 |
  | `node:26-slim` のベースが Debian 13 (trixie) | I-7。ネイティブ依存がないので影響は見込まない。R6.4・R6.5 で確かめる |
  | `http.Server.prototype.writeHeader` の削除（#60635）、旧 `_stream_*` モジュールの削除（#60657） | 当たらない。first-party のコードに使用箇所がない（grep で 0 件） |
  | Temporal を既定で有効化、V8 14.6、Undici 8、`NODE_MODULE_VERSION` 147 | 直接の使用箇所はない。`mise run check` が Node 26 で緑（事前検証）。ネイティブアドオンはビルドしていない（`allowBuilds` は全部 `false`） |
  | DEP0182 の end-of-life 化、DEP0201 / 0203 / 0204 の実行時非推奨化 | first-party の該当は未特定。worker の全モジュールを `--throw-deprecation` 付きで読み込んで exit 0（I-2）なので、worker の読み込み経路にはない |

  `stripTypeScriptTypes` は v24 と v26 のどちらでも「Stability: 1.2 - Release candidate」。実行時には両方の版で
  `ExperimentalWarning: stripTypeScriptTypes is an experimental feature` が出る。R1.2 が検査するのは `DeprecationWarning` だけ。
  `node_modules` 配下の型除去を拒む制限（`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`）は v24 と v26 で変わらない。
  ローダーが要る理由は残る。
- **Evidence**: `https://nodejs.org/en/blog/release/v26.0.0`、`https://nodejs.org/docs/latest-v26.x/api/module.html`、
  `https://nodejs.org/docs/latest-v26.x/api/typescript.html`。使用箇所は `git grep` で確かめた。
- **未確認**: `CHANGELOG_V26.md` の本文は開いていない。`node:test`、`fs`、`url.parse`、`--throw-deprecation` の変更の有無は、
  公式の一覧では確かめていない。web と packages の経路は、Node 26 での `mise run check`・`build`・CI の E2E で確かめる（R6）。

### I-6: Node 26 のイメージに corepack がない（spec と gap-analysis にない発見）

- **Question**: 現在の `apps/worker/Dockerfile` は `node:26-slim` でビルドできるか。
- **Findings**: **できない見込み**。build 段の `RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate` が、
  コマンドがないために失敗する。

  | 検査 | `node:24-slim` | `node:26-slim` |
  |---|---|---|
  | `node -v` | v24.22.3 | v26.13.1 |
  | `npm -v` | 11.19.1 | 11.20.0 |
  | `command -v corepack` | `/usr/local/bin/corepack` | **なし** |
  | `npm install --global pnpm@12.8.2` → `pnpm --version` | exit 0、`12.8.2` | exit 0、`12.8.2` |

  mise が入れた Node 26.13.1 の `bin/` にも corepack はない（24.22.3 にはある）。
- **Evidence**: `docker run --rm node:<tag> sh -c '…'` の出力。公式イメージの Dockerfile
  （`nodejs/docker-node` の `26/trixie-slim/Dockerfile`）に corepack の記述はない。v25.0.0 のリリースノートに
  "build: stop distributing Corepack (#57617)"、"build: remove corepack from release tarballs (#59835)" がある。
  v26 の API 文書に `corepack.html` はない（404）。
- **設計への反映**: build 段の pnpm の用意を `npm install --global pnpm@${PNPM_VERSION}` に変える（plan DES-1.3、D-2）。
  Node 24 と 26 の両方のイメージで動くので、ローダーと同じ「両対応の修正」として版コミットより前に置く。
  spec の Scope は Dockerfile について `ARG NODE_VERSION` だけを挙げているが、この 1 行を直さないと R6.4 を満たせない。
- **未実施**: `docker build` そのもの（実装フェーズの R6.4）。`pnpm install --frozen-lockfile` と `pnpm deploy` が
  npm で入れた pnpm 12.8.2 で通るかは、そこで確かめる。

### I-7: 公式イメージのベース OS（gap-analysis §6-5）

- **Question**: `node:24-slim` から `node:26-slim` へ移すと、Node 以外に何が変わるか。
- **Findings**: `node:24-slim` は Debian 12 (bookworm)、`node:26-slim` は Debian 13 (trixie)。yarn 1.x も 26 のイメージにはない。
  worker の本番依存（`pg`、`redis`、`inngest`、`drizzle-orm`）は pure JS で、ネイティブビルドをしない
  （`pnpm-workspace.yaml` の `allowBuilds` は全部 `false`）。OS のライブラリには依存しない。
- **Evidence**: 上の `docker run` の `/etc/os-release`（"Debian GNU/Linux 13 (trixie)" / "12 (bookworm)"）。
  `docker-library/official-images` の `library/node`。
- **設計への反映**: タグは `-slim` のまま、Debian の版を明示して固定しない（公式の既定に従う。revert すると bookworm に戻る）。
  検証記録に OS の版を残す。

### I-8: イメージの検証コマンド（gap-analysis §6-5、R6.4・R6.5）

- **Question**: DB と Inngest に接続せずに、コンテナ内で worker の全モジュールを読み込むコマンドは何か。
- **Findings**: ホストでは次の `--eval` が、両方の版で `all-loaded 7`、exit 0、`DeprecationWarning` なしで終わる。
  `src/start.ts` は `import.meta.main` で起動を守っているので、import しても接続しに行かない。コマンドは plan の
  「検証手順」V-5 で固定する。Docker デーモンは Rancher Desktop の context（`unix://~/.rd/docker.sock`）で応答する。
  `node:26-slim` の pull もできた（gap-analysis の時点では止まっていた）。
- **Evidence**: I-2 の 3 行目。`docker version` の出力。
- **未確認**: コンテナの中（`NODE_ENV=production`、`pnpm deploy --prod` の配置）で同じ結果になるか。実装フェーズで確かめる。

### I-9: CI が Node を用意する方法（R2.4）

- **Findings**: `.github/workflows/` の 9 ファイルのうち 7 ファイル・13 か所が `jdx/mise-action@b44d12e…`（v5.2.7）を使う。残り 2 ファイル
  （`codeql.yml`、`dependency-review.yml`）は mise も Node も使わない。したがって R2.4 のガードは、肯定条件（「Node を使うなら mise-action」）ではなく、
  否定条件（`setup-node`・`node-version`・`NODE_VERSION` がない）だけで書く。
  `setup-node`、`node-version`、`NODE_VERSION` は 0 件。ワークフローの変更は要らない。これを検査するガードはない。
- **Evidence**: `grep -rnE "setup-node|node-version|mise-action|NODE_VERSION" .github/workflows/`。

### I-10: 残っている「Node 24」の記述（R5.5）

- **Findings**: plan で固定する grep（V-7）の現在の結果は 17 行。内訳は、憲章 1、steering 1、`AGENTS.md` 1、`CLAUDE.md` 1、
  `README.md` 5、`docs/dependency-policy.md` 2、`docs/cross-repo-adoption-backlog.md` 2、`docker-compose.yml` 1、
  `apps/worker/tsconfig.json` 1、`apps/worker/src/main.ts` 1、`apps/worker/register-typescript-loader.mjs` 1。
  `pnpm-lock.yaml` の `@types/node` は 28 件すべて `26.6.6`。
- **設計への反映**: 移行や両対応を述べる行は、同じ行に「Node 26」を書く。こうすると、grep の残りが過去の記録の 1 行
  （backlog の X-15 の行）だけになったかどうかを機械的に判定できる。

### I-11: 憲章改正と記録の前例（gap-analysis §6-7）

- **Findings**: 憲章は 2.3.1（2026-11-14）。先頭の Sync Impact Report は 2.2.0 → 2.3.0 の内容のままで、2.3.1 は反映されていない。
  前例の 2.3.0 は `specs/009-agent-ui-and-beta-intake/reviews/python314-constitution-r1.md` に、新規コンテキストのレビュー
  （指摘 7 件と対応）と人間承認（承認者、日時、範囲）を残している。spec 010 は `reviews/adversarial-r1.md` を持つ。
- **設計への反映**: 2.3.1 → 2.4.0（MINOR）。レビュー記録は `reviews/node26-constitution-r1.md`、フェーズ完了後の敵対的レビューは
  `reviews/adversarial-r1.md`（原則 10）。

## Existing patterns to reuse

| Pattern | Location | Why reuse |
|---------|----------|-----------|
| 子プロセスでローダーを起動し、終了コードと出力を検査する | `apps/worker/tests/typescript-loader.spec.ts` | 実際の `--import` の経路を通す。`process.execPath` を使うので、テストを動かした Node の版がそのまま検査対象になる |
| 追随箇所を正本と突き合わせる repo ガード | `tests/repo/container-toolchain-pins.spec.ts` | `engines.node` の追随も同じ形で書ける。パースできないときに落ちる anti-false-green の検査が既にある |
| 「scanned > 0」を先に検査する | `tests/repo/ci-workflows.spec.ts:43` | ワークフローに Node の版を書かないことの検査を、同じファイルに足せる |
| 据え置きを 3 か所で揃える | `docs/dependency-policy.md` §7、`.github/dependabot.yml`、`tests/repo/dependabot.spec.ts` の `HELD_BACK` | R3 はこの 3 つを 26 へ移すだけ |
| 憲章改正のレビュー記録 | `specs/009-agent-ui-and-beta-intake/reviews/python314-constitution-r1.md` | 節の構成（Trigger、Proposed Amendments、Findings、Human approval、Outcome）をそのまま使う |
| ADR の書式 | `docs/adr/0009-typescript-7-adoption.md` | Status、Date、仕様根拠、関連レビュー、Context、Decision、Consequences |
| 検証記録 | `specs/009-agent-ui-and-beta-intake/pdca/do.md` | タスクごとに RED → GREEN とコマンドの結果を残す |
| 基準のコミットを別の作業ツリーで動かす | `~/.agents/AGENTS.md`「`git worktree add`」 | 未コミットの作業を壊さずに、ローダーのコミットだけの状態（R7.3）と revert 後の状態（R7.4）を検査できる |

## External dependencies

第三者依存の追加はない。版が変わるものだけを挙げる。

| Dependency | Version | Purpose | Verified |
|------------|---------|---------|----------|
| Node.js | 24 LTS → 26 LTS（正本は major のみ。実測は 26.13.1） | TS ランタイム | ✅ ローカルで `mise run check` が緑（事前検証）。イメージは未実施 |
| `@types/node` | `^24.19.2` → `^26.6.6`（root と `apps/worker`） | Node の型 | ✅ lockfile の解決は 28 件すべて `26.6.6` |
| `node:<major>-slim` | `24-slim`（Debian 12）→ `26-slim`（Debian 13） | worker イメージのベース | ✅ pull と `node -v` まで。build は未実施 |
| pnpm（イメージ内） | 12.8.2 のまま。入れ方が corepack → npm | イメージのビルド | ✅ 両方のイメージで `npm install --global` が成功 |

## Architecture decisions

この節の判断は **D-1〜D-4** と呼ぶ。リポジトリ既存の `ADR-2`（承認契約）、`ADR-3`（DI）、`ADR-5`（モデル ID）と
取り違えないため（`/sdd-analyze` N-2）。D-1 と D-2 は `docs/adr/0010-worker-typescript-loader.md` に昇格する。

### D-1: worker ローダーは `registerHooks()` と `mode: "strip"` を使う（`docs/adr/0010` に昇格する）

- **Context**: Node 26 は `transform` を削除し、`module.register()` を実行時非推奨にした。`node_modules` 配下の型除去を拒む
  制限は残る。
- **Decision**: 同期フック `registerHooks({ resolve, load })` と `stripTypeScriptTypes(source, { mode: "strip", sourceUrl })`。
  source map は使わない。型除去で扱えない構文は `erasableSyntaxOnly` で typecheck の段階で止める。
- **Alternatives**: (a) `register()` のまま警告を抑える（`--no-deprecation`）→ 削除が予告されている。警告を隠すと、他の非推奨も
  見えなくなる。(b) worker にビルドを入れる（tsc や esbuild で JS を出す）→ source-only の方針と spec の Out of scope に反する。
  (c) `tsx` などのローダーを足す → 第三者依存の追加になる（原則 11）。(d) `@vaz/*` を `node_modules` の外へ置く → `pnpm deploy` の
  配置を変える必要があり、変更が大きい。
- **Consequences**: Node 24 と 26 の両方で動く（I-2）。スタックの位置が元のソースと一致する（I-4）。API は release candidate で、
  実行時には `ExperimentalWarning` が出る。

### D-2: イメージ内の pnpm は npm で入れる

- **Context**: Node 25 以降は corepack を同梱しない（I-6）。
- **Decision**: `RUN npm install --global pnpm@${PNPM_VERSION}`。`ARG PNPM_VERSION` と
  `tests/repo/container-toolchain-pins.spec.ts` のガードはそのまま使う。
- **Alternatives**: (a) `npm install --global corepack@<版>` を挟む → 固定する版が 1 つ増え、ガードも要る。(b) pnpm の
  インストールスクリプトを使う → `curl` が slim に残らない。パイプで実行する形にもなる。(c) `node:24-slim` に据え置く → 目的に反する。
- **Consequences**: Node 24 のイメージでも動くので、版コミットを revert してもビルドできる。
  **保証の位置が変わる**（`/sdd-analyze` N-3）。corepack は `packageManager` の `+sha512` を、取得した tarball に対して
  ビルドのたびに照合していた。npm 経由ではその照合がビルドの中になくなり、npm がレジストリのメタデータ（`dist.integrity`）と
  照合するだけになる。これはレジストリ自身が返す値なので、独立して固定したハッシュではない。
  - **実測（2026-11-15、pnpm 12.8.2）**: `npm view pnpm@12.8.2 dist.integrity` を base64 から hex へ戻すと
    `a5941679…b8b11` で、root `package.json` の `packageManager` の `+sha512.` と**全桁一致した**。つまり現時点では
    同じ tarball を指している。ただしこの一致は「今そうである」ことの確認で、ビルドが毎回強制するものではない。
  - **補う手段**: V-5 に、この一致の再確認（host で `npm view` の値を hex に直して `packageManager` と比較）を足し、結果を
    `do.md` に残す。ビルド内への照合の追加は、Dockerfile の変更が増えるので本 spec では行わない（ADR-0010 の再検討条件に書く）。
    ADR-0010 の Consequences に「ビルド時の sha512 照合は失われた」と明記する。

### D-3: コミットを 5 つの役割に分け、ロールバックは版と文書を一緒に戻す

- **Context**: R7。pre-commit フックは作業ツリー全体を検査するので、未コミットの版の変更が残っていると、ローダーのコミットを
  単独で検査したことにならない。
- **Decision**: 両対応の修正（ローダー、Dockerfile の pnpm）→ ガード → 版 → 文書 → 検証記録、の順にコミットする。
  ローダーのコミットだけの状態と revert 後の状態は、`git worktree add` で作った別の作業ツリーで検査する。
- **Alternatives**: `git stash` で版の変更を退避する → 未コミットの作業を失う危険がある（利用者の規約で、変更のあるファイルには使わない）。
- **Consequences**: 検査のたびに別の作業ツリーで `pnpm install` が要る。

### D-4: 憲章は 2.4.0（MINOR）

- **Context**: 2.3.0（Python 3.14）は MINOR、2.3.1（uv 0.13）は PATCH で、基準が文面にない。
- **Decision**: 意図した版上げ（判断の変更）は MINOR、実態への追随（強制された訂正）は PATCH。この基準を Sync Impact Report に
  一行で書く（spec Clarifications）。
- **Consequences**: 次の版上げで基準が揺れない。

## Risks & open questions

- ⚠️ `docker build` が npm で入れた pnpm で失敗する（`packageManager` の照合、`pnpm deploy` の挙動）— mitigation: 実装の最初に
  build を実行する。失敗したら原因を特定し、D-2 の代替 (a) を検討する。plan を改正してから進む。
- ⚠️ コンテナの中（`NODE_ENV=production`、`pnpm deploy --prod`）で、全モジュールの読み込みが環境変数を要求する — mitigation: V-5 で
  最初に確かめる。要求された場合は、接続しないダミーの値を `-e` で渡し、その事実を記録する。
- ⚠️ `stripTypeScriptTypes` と `registerHooks()` は release candidate。Node 27 以降で変わりうる — mitigation: 回帰テストが両方を通る。
  ADR-0010 に再検討条件を書く。
- ⚠️ Debian 13 への移行で、実行時にだけ出る差がある — mitigation: R6.5 の読み込み検査。Inngest に接続した実走は Future Work。
- ⚠️ Node 26 で初めて CI を走る E2E と `eval-pr.yml` が落ちる — mitigation: R6.6。落ちたら停止して原因を特定する（原則 9）。
- ✅ Dockerfile の pnpm の入れ方の変更（I-6）は、spec の R2.6 として Scope に加えた（`/sdd-analyze` の指摘 M-1「spec にない Dockerfile の変更」、2026-11-15）。
- ❓ `tests/repo/container-toolchain-pins.spec.ts:15` のコメント「what corepack activates everywhere else」は、Node 26 では
  事実と合わない（ローカルと CI の pnpm は mise が用意する）。コメントだけを直す — to resolve in: 実装（ガードのコミット）。
