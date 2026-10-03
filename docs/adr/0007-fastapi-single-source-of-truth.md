# ADR-0007: FastAPI レーンの正本を `services/api` に一本化する

- **Status**: Accepted
- **Date**: 2026-10-03
- **仕様根拠**: [`specs/008-hub-consolidation-followup/spec.md`](../../specs/008-hub-consolidation-followup/spec.md) R1・R2、
  [ADR-0003](./0003-consolidation-direction.md)（`services/api` を配置先とした決定）、
  `specs/006-repo-consolidation/pdca/act.md` R9.4（アーカイブ判断の保留条件）

散文は日本語、識別子・型・パス・コードは英語（`spec.json` `language: ja`）。

## Context

spec `006` Task 6（2026-09-21）は `fastapi-pydantic-ai-agent@c12ac7f` を
`git subtree add --squash` で `services/api/` に取り込んだ。ただし**どちらが正本か**は
宣言しなかった。そのため取り込み後も元リポジトリ側で開発が続き、2026-10-03 時点で
次の分岐が生じていた（実測）。

| 元リポジトリのコミット | 内容 | `services/api` への反映 |
|---|---|---|
| `d9a3c93` | セッション予算超過からの回復、RAG エージェントの role 分離（`instructions=`）、chat agent の `system_prompt` → `instructions` | **未反映**（`app/` 6 ファイルが差分） |
| `e606e07` | 上記テストのダミー鍵 2 件を `.gitleaksignore` に登録 | 未反映 |
| `3240c41` / `5b9c6e7` | 依存の更新、`sentence-transformers` 下限を 6.1.0 へ | ハブ側が独自に同等の検証を実施済み。下限のみ相違 |
| `a9baf8e` | `jdx/mise-action` 4.3.0 | ハブの `.github/` は独立管理のため対象外 |

特に `d9a3c93` の RAG role 分離は、`app/workflows/rag_prompts.py` 自身のセキュリティ注記が
「本当の防御」と呼ぶ対策そのものである。それがハブ側に無かった。二重保守は「将来のリスク」
ではなく、**取り込みから 3 日でセキュリティ修正の欠落として顕在化していた**。

## Decision

**FastAPI + Pydantic AI レーンの正本はハブの `services/api/` とする。**
`Fukuchan77/fastapi-pydantic-ai-agent` は README をハブへ誘導する形に改め、
GitHub 上で Archive（read-only）にする。

1. 元リポジトリの `c12ac7f..main` の差分は spec `008` Task 1 でハブへ移植済みとする:
   `d9a3c93` は `git am --directory=services/api` で履歴つきで移植し、`.gitleaksignore` には
   移植コミットの SHA で 2 件を再登録した。`sentence-transformers` の下限は 6.1.0 に揃えた。
   `.github/` と `mise.toml` の変更は、ハブ側に同等物があるため移植しない。
2. spec `006` R9.4 がアーカイブを保留した条件（pre-commit / pre-push フックが未配線）は、
   spec `008` Task 2 で解消した。フックは `services/api/scripts/hooks/{pre-commit,pre-push}.sh`
   として実装し、ハブの `.githooks/` から呼ぶ。gitleaks の baseline は 2026-09-22 にハブ側で
   再生成済み（`.gitleaksignore`）。
3. 以後 `services/api/` は **vendored subtree ではない**。上流から `git subtree pull` することは
   ない。ハブの中で直接修正・進化させる。

### 単独テンプレートとして残す案を採らない理由

- 2 か所で編集できる限り、どちらかの修正は必ずもう一方から漏れる。上の表がその実例である。
  運用ルール（「`services/api` は直接編集しない」）で防ぐ案も検討したが、Task 6 自体が
  `services/api` 側に移送用の変更を入れており、ルールは初日から守れない形だった。
- 「FastAPI 単体のテンプレート」という価値は、ディレクトリ単位の切り出し
  （`degit`、`git subtree split --prefix=services/api`）で必要なときに得られる。
  恒常的なミラーを持つ必要はない。

## Consequences

- `tests/repo/doc-links.spec.ts` の `VENDORED_ROOTS` は、`services/api` を「上流が正しさを
  保つ」領域として除外している。本 ADR によりその前提は消えた。ただし除外を外すと
  上流由来の壊れたリンク（`config.py` → `config/` パッケージ化など）が表面化する。
  これを直すまでは除外を維持し、spec `008` の申し送り事項として扱う。
- `services/api/CLAUDE.md` と `AGENTS.md` の冒頭注記（「移送に伴う変更点以外は unmodified」）は
  時点の記録として残す。以後の変更はハブの通常の変更として扱う。
- ハブの PR は `.gitleaksignore` がコミット SHA で fingerprint を固定しているため、
  **squash / rebase merge ではなく merge commit で取り込む**（既存の運用どおり）。

## Re-trigger Conditions

1. FastAPI レーンを複数のプロダクトリポジトリが**依存として**取り込む必要が生じたとき
   （コピーではなく、バージョン付きで再利用したいとき）。その時点で `services/api` から
   パッケージ／テンプレートを切り出し、配布物として正本を移す案を再評価する。
2. ハブのリポジトリ規模や CI 時間が Python レーンの開発速度を明確に阻害したとき。
