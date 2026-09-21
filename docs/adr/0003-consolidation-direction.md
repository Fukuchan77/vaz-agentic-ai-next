# ADR-0003: 5 リポジトリ統合の方向 — `vaz-ai-next` の昇格と継承 spec の扱い

- **Status**: Accepted
- **Date**: 2026-09-21
- **仕様根拠**: `specs/006-repo-consolidation/spec.md` R4.1〜R4.6, NFR-3（本 ADR の起票元）、
  `specs/inherited/001-agentic-ai-core-p0/spec-agenticai-core.md` v1.7（supersede 対象）、
  `specs/memory/constitution.md` v1.2.0（本 ADR が従う統治規範）

散文は日本語、識別子・型・パス・コードは英語（`spec.json` `language: ja` の慣例に合わせる）。

---

## Context

Agentic AI 系 5 リポジトリ（`vaz-ai-next` / `fastapi-pydantic-ai-agent` / `pydantic-ai-sandbox` /
`pydantic-ai-agentic-patterns` / `vaz-agentic-ai-next`）には、**統合の向きについて独立に書かれた
2 つの設計判断**が存在していた。

1. **`vaz-agentic-ai-next@claude/agentic-ai-repo-design-3k8e32` の `specs/001-agentic-ai-core-p0/`**
   （2026-08-29 起票・v1.7・53 要件・approved）は、**新リポジトリ側が `vaz-ai-next` を取り込む**
   向きで設計されていた。同 spec `spec.json` の `repository.note` はこれを明文で述べている:
   「This repository is NOT vaz-ai-next. vaz-ai-next is an upstream repository whose contents are
   imported by T-0.」同 spec `tasks.md` の T-0 は「母体 monorepo の取り込み」、T-1.2/T-1.3 は
   `turbo.json` とルート `pyproject.toml` の新設、T-2 は `fastapi-pydantic-ai-agent` を
   `apps/agent-api` として移植する内容だった。

2. **2026-09-21 の統合計画**（`specs/006-repo-consolidation/` の入力）は逆の向きを採った:
   **`vaz-ai-next` をリネームして昇格させる**。根拠は `vaz-ai-next` が polyglot レーン分離・
   durable HITL・3 層 evals・境界契約 codegen を**既に実装済み**であり、再構築するより
   実体を昇格させるほうが実装量が少ないという判断（`specs/006-repo-consolidation/spec.md` 前文）。

`vaz-agentic-ai-next` は 2026-09-21 に `vaz-agentic-ai-next-archive` へリネームされ、
`vaz-ai-next` が `vaz-agentic-ai-next` として昇格した（Task 1/2、`pdca/do.md`）。両文書は
もはや同時に「正」ではあり得ず、どちらの組み立て機構を採るか、53 要件をどう扱うかを
本 ADR で確定する。

## Decision

**`vaz-ai-next` をリネームして昇格させる方向を採用する。** 継承した P0 spec の
**組み立て機構のみ**を supersede し、**53 要件は有効な製品要件として継承する**。

### 1. supersede する対象（機構のみ）

継承 spec `specs/inherited/001-agentic-ai-core-p0/tasks.md` のうち、次の 4 タスクは
本統合の向きと矛盾するため実行しない:

| タスク | 内容 | supersede する理由 |
|---|---|---|
| `T-0` | 母体 monorepo（`vaz-ai-next@cf72583`）の取り込み | 取り込みではなくリネームによる同一性移行を採った。ソースを import するコピー操作は発生しない |
| `T-1.2` | ルート `turbo.json` の新設 | 本統合は Turborepo を採らない（§「Turborepo を採らない根拠」） |
| `T-1.3` | ルート `pyproject.toml` の新設（`[tool.uv.workspace]`） | 同上。ルート uv workspace 自体を作らない |
| `T-2` | `fastapi-pydantic-ai-agent@d4d5f8d` を `apps/agent-api` として移植 | Python レーンは `services/api`（下記）。`apps/` は pnpm workspace（Node）に予約する |

**53 要件（chat / HITL / RAG / 可観測性 / CI）は supersede しない。** これらは
「何を実現するか」の記述であり、「どう組み立てるか」の記述ではない。継承 spec
`spec.md` 補遺（2026-09-06 反映、X-5/X-10/X-13/X-14 反映済み）も「本要件セクションの
53 要件は増減していない」と記録しており、本 ADR はその状態を引き継ぐ。

### 2. 両文書が独立に同じ結論へ到達した事実

継承 spec `tasks.md` の T-1.3 は着手前に **ADR-P0-05** を必須としており、その採用決定は
**候補 (a)**: 「`apps/agent-api` を uv workspace のメンバーに**含めない**。独自 `uv.lock`
（`cd apps/agent-api && uv lock`）を持ち、Turborepo の Python 管理外となる。Python タスクは
`mise` 直接実行（退避経路 — ADR-P0-01）で運用する」だった。

統合計画 §4.2 は独立に同じ方向へ到達している: `vaz-ai-next` にはルート `pyproject.toml` /
`uv.lock` が無く、`services/agent` は自前のロックを持つ独立レーンである（`mise.toml` の
`py:check` タスクが `dir = "services/agent"` を持ち、`check` の依存グラフから意図的に外れている）。

**本 ADR はこの極限形を採る**: ルート `pyproject.toml` を新設する代わりに、**そもそも作らない**。
継承 spec の ADR-P0-05 が「ルート workspace を作ったうえでメンバーから外す」という迂回路
（同 spec 自身が「退避経路」と呼ぶ）を通ったのに対し、本 ADR は迂回の必要自体を消す。
根拠の骨格（二層バージョン方針と単一 lock の構造的非両立）はそのまま再利用できる。

### 3. Python レーンの配置: `services/api`（`apps/agent-api` ではない）

継承 spec は `apps/agent-api` を配置先としていたが、本 ADR は **`services/api`** を採る。

- `apps/` はハブの pnpm workspace メンバー（`@vaz/web` / `@vaz/worker`、いずれも Node/TS）に
  予約されている。Python プロセスを `apps/` 配下に置くと、pnpm ワークスペースの走査規則
  （`pnpm-workspace.yaml` の `packages:`）と Python パッケージ管理が同一ディレクトリ階層で
  混在し、「`apps/` = pnpm メンバー」という現在の一意な対応が崩れる。
- `services/agent`（既存の Python サイドカー: docling パース + LlamaIndex LLM-judge eval）が
  既に `services/` を「非 Node ランタイムのサイドカー群」の置き場として確立している。
  `services/api` はこれと**対称的な第 2 のメンバー**として自然に収まる。

### 4. Turborepo を採らない根拠

- 統合計画 §5.1: Turborepo の Python 対応は 2.10.13 で `FutureFlags` 下の **experimental**
  （2026-09 時点）。土台を賭けるべき成熟度にない。
- 継承 spec §12 R14: 「どのメンバーを uv workspace に含めるかは、Turborepo の Python サポートの
  採否と同一の決定である」。Turborepo を採らない以上、uv workspace 化それ自体の動機も消える。
- `[tool.turbo] name = "..."` の宣言義務（継承 spec `tasks.md` T-1.3 が指摘する
  「未宣言だと turbo が `The uv workspace has no name.` で起動しない」制約）は、
  Turborepo を採らない本 ADR の下では発生しない。

## Consequences

- `specs/inherited/001-agentic-ai-core-p0/` は**参照専用**として保持する。53 要件は将来の
  Phase（services/api 以降）で個別に引用され、実装タスクへ落とし込まれる際に本 spec の
  トレーサビリティキーとして使われる。ハブの `001-vaz-ai-update` との採番衝突を避けるため
  `specs/` 直下ではなく `specs/inherited/` に隔離する（R4.2）。
- `specs/inherited/001-agentic-ai-core-p0/spec.md` のヘッダには「`approvals.tasks` は未承認」
  という記述が残るが、同 spec の `spec.json` は `approvals.{requirements,design,tasks}` を
  いずれも `approved: true` としている。両者の不整合は継承元の記録上の揺れであり、本 ADR は
  構造化データである `spec.json` を優先する（本 spec `spec.json` の `approvals` フィールドと
  同じ役割）。53 要件を有効な製品要件として扱うという本 ADR の決定に影響しない。
- `apps/agent-api` という配置は今後のいかなる spec でも使わない。`services/api` が唯一の
  正しい配置先である。

## Re-trigger Conditions

次のいずれかが成立した時点で、本 ADR（特に「Turborepo を採らない」「ルート uv workspace を
作らない」の 2 点）を再評価する:

1. **Turborepo の Python サポートが GA になった時**。`FutureFlags` を外れ安定版になった場合、
   `services/agent` / `services/api` を含む複数 Python レーンのタスクオーケストレーションを
   一元化する価値が、独立レーンの単純さを上回るかどうかを再検討する。
2. **Python レーンが 3 つ以上になった時**。現在の `services/agent` + `services/api` の 2 レーンは
   `mise.toml` タスクの手書き複製で足りるが、3 つ目が加わると重複コストが無視できなくなる
   可能性がある。

## References

- [`specs/006-repo-consolidation/spec.md`](../../specs/006-repo-consolidation/spec.md) R4（本 ADR の起票元）
- [`specs/006-repo-consolidation/plan.md`](../../specs/006-repo-consolidation/plan.md) §2.1
- [`specs/inherited/001-agentic-ai-core-p0/spec-agenticai-core.md`](../../specs/inherited/001-agentic-ai-core-p0/spec-agenticai-core.md) v1.7（supersede 対象の一次情報源）
- [`specs/inherited/001-agentic-ai-core-p0/tasks.md`](../../specs/inherited/001-agentic-ai-core-p0/tasks.md) T-0, T-1.2, T-1.3, T-2, ADR-P0-05
- [`specs/memory/constitution.md`](../../specs/memory/constitution.md) v1.2.0
- [`docs/cross-repo-adoption-review.md`](../cross-repo-adoption-review.md) §6 追記
- [`docs/adr/0001-mcp-position.md`](./0001-mcp-position.md)（節構成の前例）
- `mise.toml` `py:check` タスク（`services/agent` の独立レーン設計の実例）
