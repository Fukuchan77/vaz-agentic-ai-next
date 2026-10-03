# Structure

この文書は、コードの置き場所と依存方向を決める構造パターンを記録する。全ファイル一覧ではない。

## Organization Pattern

リポジトリは **apps / source-only packages / independent services** の三層 monorepo である。

- `apps/` は composition root。認証、HTTP、DB connection、worker transport など実行環境を組み立てる。
- `packages/` は再利用可能な TypeScript の契約とドメイン能力。package ごとの build artifact は作らない。
- `services/` は Python の独立プロセス。TypeScript package を直接 import せず、HTTP と生成契約で接続する。

Web UI は feature-first を使う。例えば chat の UI と表示ロジックは
`apps/web/src/features/chat/` に置き、route handler や composition は `apps/web/src/app/` と
`apps/web/src/lib/` が担当する。

## Directory Map (high level)

| Path | Holds |
|---|---|
| `apps/web/` | Next.js UI、認証済み route、server-side adapter、Web 固有の composition |
| `apps/worker/` | Inngest worker、durable job、event / audit adapter |
| `packages/schemas/` | 共有 Zod schema、型、env schema、生成されたサービス契約 |
| `packages/config/` | provider、model、role など検証済み設定の解決 |
| `packages/tools/` | AI SDK tool と allowlist。orchestration を持たない |
| `packages/rag/` | ingest / retrieval と embedding provenance |
| `packages/agents/` | chat agent、supervisor、approval policy、agent lifecycle |
| `packages/db/` | schema と DB port。上位の agent / UI を import しない |
| `packages/evals/` | golden set、judge、regression gate |
| `services/agent/` | 文書解析・評価用の stateless FastAPI sidecar |
| `services/api/` | Pydantic AI ベースの独立 agent API 正本 |
| `tests/repo/` | repository policy、CI、文書リンクなど横断 guard |
| `docs/adr/` | 採否、理由、再検討条件を持つ architecture decision |
| `specs/` | 要件、設計、task、検証記録 |

## Naming Conventions

- TypeScript component / class / type: `PascalCase`。関数・変数・file module は既存領域の
  `camelCase` または kebab-case に合わせる。
- React component は `ChatComposer.tsx` のように component 名と file 名を一致させる。
- Next.js の protocol file は `page.tsx`、`layout.tsx`、`route.ts` の規約を使う。
- Test は対象に対応する `*.spec.ts` / `*.spec.tsx`。Python は `test_*.py`。
- Python symbol と Pydantic field は `snake_case`、class は `PascalCase`。
- ADR は `NNNN-short-title.md`、spec は `NNN-feature-name/` を使う。
- 識別子、型、path、code comment は英語。spec の散文は `spec.json.language` に従う。

## Import / Dependency Rules

TypeScript の依存方向は次を維持する。

```text
schemas, db
  ↓
config, tools, rag
  ↓
agents
  ↓
apps/web, apps/worker, evals
```

- `@vaz/schemas` と `@vaz/db` は leaf package とし、`@vaz/*` runtime import を持たせない。
- package 間は public subpath import を使い、他 package の `src/` 内部へ相対 import しない。
- `@vaz/rag` の Node native ESM CLI では self-reference subpath import を使う。
- UI や route から provider SDK を直接選択せず、`@vaz/config` の model resolution へ委譲する。
- tool は agent を import しない。agent が tool を組み立て、app が dependency を注入する。
- Python services は DB embedding を書かない。pgvector の writer は TypeScript RAG lane だけである。
- Web から Python service へは server-side adapter を通し、service key を browser へ渡さない。

## Boundary Patterns

- 外部 request → schema parse → domain call → response serialization の順序を守る。
- route handler は薄く保ち、認証・parse・adapter 呼び出しを担当する。agent logic は package へ置く。
- DB、clock、logger、audit、runtime context は port として注入し、module global へ埋め込まない。
- TS ⇔ Python の変更は schema、snapshot、generated type、drift test を同じ変更で更新する。
- UI component は server / client 境界を明示する。browser API または UI library を使う component だけ
  `"use client"` を宣言する。

## Where Things Go

- 新しい Web capability → `apps/web/src/features/<feature>/`。route / page は `src/app/` から接続する。
- 新しい共有 request / event → 先に `packages/schemas/src/`。consumer 固有の型へ複製しない。
- 新しい tool → `packages/tools/src/`、承認ポリシーと lifecycle 結線は `packages/agents/src/`。
- 新しい agent orchestration → `packages/agents/src/`。transport と persistence adapter は app 側。
- 新しい DB schema / migration → `packages/db/`。RAG ingest / retrieval logic は `packages/rag/`。
- 新しい Python API capability → 正本である `services/api/app/`。文書解析 sidecar は `services/agent/app/`。
- 新しい unit test → 対象 workspace の `tests/`。横断規則は `tests/repo/`。
- 新しい採用判断 → `docs/adr/`。一時的調査を恒久ポリシーとして残さない。
- 新しいプロジェクト横断パターン → `.sdd/steering/`。既存パターンに従うだけなら更新しない。
