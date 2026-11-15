# ADR-0010: worker の TypeScript ローダーを `registerHooks()` と strip モードに移し、イメージの pnpm を npm で入れる

- **Status**: 承認済み（2026-11-15）
- **承認**: 2026-11-15、Kaz（Fukuchan77）がプロジェクトスレッドで ADR-0010 そのものを承認した。
- **Date**: 2026-11-15
- **仕様根拠**: [`specs/011-node-26-runtime-upgrade/spec.md`](../../specs/011-node-26-runtime-upgrade/spec.md) R1.1, R1.2, R1.3, R1.4, R1.5, R1.6, R2.6, R8.2
- **関連レビュー**: [`specs/011-node-26-runtime-upgrade/research.md`](../../specs/011-node-26-runtime-upgrade/research.md) D-1, D-2, I-2, I-4, I-6

散文は日本語、識別子・型・パス・コードは英語（`spec.json` `language: ja`）。

## Context

`apps/worker` のコンテナは build を持たず、source-only の `@vaz/*` と `apps/worker/src` を Node 自身の型除去で読み込む。
Node の組み込みローダーは `node_modules` 配下の `.ts` の型除去を拒むため、`pnpm deploy` 後の `@vaz/*` を読むには
`apps/worker/typescript-loader.mjs` が `stripTypeScriptTypes` を明示的に呼ぶ必要がある。

Node 24 と Node 26 の間で、このローダーに 2 つの破壊的変更がある（`research.md` I-2）。

1. `stripTypeScriptTypes` の `mode: "transform"` と `sourceMap` は Node 26 で削除され、`ERR_INVALID_ARG_VALUE` で失敗する。
2. `module.register()` は Node 26 で実行時非推奨（DEP0205）になった。

さらに、Node 25 以降の公式イメージは corepack を同梱しない（`research.md` I-6）。`node:26-slim` では Dockerfile の
`corepack enable && corepack prepare` が `not found` で失敗する。

## Decision

**ローダーは同期フック `registerHooks()` と `mode: "strip"` に移す。これは Node 24 と Node 26 の両方で動く。イメージ内の pnpm は npm で入れる。**

1. **`registerHooks({ resolve, load })`**（`register-typescript-loader.mjs`）。`resolve` と `load` は同期関数にする。
   `resolve` は拡張子のない相対 specifier が `ERR_MODULE_NOT_FOUND` のときだけ `.ts` を補い、他のエラーは投げ直す。
   `load` は `file:` かつ `.ts` で終わる URL だけを `stripTypeScriptTypes(source, { mode: "strip", sourceUrl })` で変換する。
2. **`mode: "strip"` だけを使う。** `sourceMap` は渡さない。strip は型を空白に置き換えるので、行と列は元のソースと一致する。
3. **型除去で扱えない構文は `erasableSyntaxOnly` で止める。** `enum`、`namespace`、パラメータプロパティは、typecheck の段階
   （`packages/config/tsconfig.base.json` の `erasableSyntaxOnly`）で型エラーにする。実行時に漏れた場合は
   `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` で失敗し、握りつぶさず、変換にも切り替えない。ガードは
   `tests/repo/worker-erasable-syntax.spec.ts` が設定の実効値で固定する。
4. **イメージの pnpm は `npm install --global pnpm@${PNPM_VERSION}`** で入れる。`ARG PNPM_VERSION` の値と、
   `container-toolchain-pins.spec.ts` のガードはそのまま使う。Node 24 と Node 26 のイメージの両方で動く。
5. **回帰テスト** `apps/worker/tests/typescript-loader.spec.ts` は、`node_modules` 配下の実ファイル（symlink ではない）を
   使って `load` フックの働きを検査する。workspace の `@vaz/*` は symlink で、Node が realpath を使うため、`load` フックを消しても通る。

## Alternatives

- **`register()` のまま警告を抑える（`--no-deprecation`）**: 削除が予告されている。警告を隠すと、ほかの非推奨も見えなくなる。
- **worker にビルドを入れる（tsc や esbuild で JS を出す）**: source-only の方針と spec の Out of scope に反する。
- **`tsx` などのローダーを足す**: 第三者依存の追加になる（憲章 原則 11）。
- **`@vaz/*` を `node_modules` の外へ置く**: `pnpm deploy` の配置を変える必要があり、変更が大きい。
- **pnpm: `npm install --global corepack@<版>` を挟む**: 固定する版が 1 つ増え、ガードも要る。
- **pnpm: インストールスクリプトを使う**: slim に `curl` が残らず、パイプで実行する形にもなる。
- **pnpm: `node:24-slim` に据え置く**: Node 26 へ上げる目的に反する。

## Consequences

- Node 24 と Node 26 の両方で動く。そのため、版コミットを revert しても worker はビルドでき、起動できる。
- スタックの位置が元のソースと一致する（`research.md` I-4）。
- `module.registerHooks()` と `stripTypeScriptTypes` は Node の release candidate の API で、実行時に `ExperimentalWarning` が出る。
- **保証の位置が変わった。** corepack は `packageManager` の `+sha512` を、取得した tarball に対してビルドのたびに照合していた。
  npm 経由では、その照合がビルドの中からなくなり、npm がレジストリのメタデータ（`dist.integrity`）と照合するだけになった。
  これはレジストリ自身が返す値で、独立して固定したハッシュではない。2026-11-15 の実測（pnpm 12.8.2）では、`npm view` の
  `dist.integrity` を hex に直した値が root `package.json` の `packageManager` の `+sha512.` と全桁一致した（`research.md` D-2）。
  ただし、これは「今そうである」ことの確認で、ビルドが毎回強制するものではない。検証手順 V-5 に、この一致の再確認を入れている。
- 非 erasable な構文は typecheck で止まる。実行時の失敗は最後の砦で、通常は起きない。

## Re-trigger Conditions

1. `stripTypeScriptTypes` または `registerHooks()` が安定化したとき、API が変わったとき、または削除が予告されたとき。
2. worker にビルドを導入するとき（ローダー自体が不要になる）。
3. Node の組み込みローダーが `node_modules` 配下の `.ts` を扱えるようになったとき（`load` フックが不要になる）。
4. ビルド内で pnpm の sha512 を照合する手段（`npm pack` の結果の照合など）を足す必要が出たとき、または
   `npm view` の `dist.integrity` と `packageManager` の `+sha512.` が一致しなくなったとき。
5. Node が corepack に代わる公式の手段を同梱したとき。
