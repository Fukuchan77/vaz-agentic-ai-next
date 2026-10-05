# Technology

この文書は、将来の実装判断を拘束する技術選択と規約を記録する。依存パッケージの全一覧ではない。

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Web | Next.js 16 App Router、React 19、React Compiler | サーバ境界を API key と認証の所有者にする |
| Agent runtime | Vercel AI SDK 7、Pydantic AI | TS と Python は契約で接続し、実装を混在させない |
| Validation | Zod v4、Pydantic | 外部・層間境界はランタイム検証を必須とする |
| Data | PostgreSQL、pgvector、Drizzle ORM | 埋め込み DB の writer は TypeScript レーンだけ |
| Workflow | Inngest、Redis | 長時間ジョブ、承認待ち、イベント配信を担当する |
| Auth | Auth.js v5 beta、OIDC、JWT | ロールは IdP claim ではなくコミット済み allowlist から解決する |
| Python services | FastAPI、Python 3.13、uv | `services/agent` と `services/api` は独立した gate を持つ |
| Testing | Vitest、Testing Library、Playwright、pytest、evals | 決定論層と実モデル層を分離する |
| Tooling | mise、pnpm、uv、Biome、Ruff、ty / pyright | バージョンとコマンド入口を固定する |

## Key Decisions

- **Source-only TypeScript packages** — `packages/*` は package build を持たず、consumer が型検査する。
  import は `@vaz/<package>/<subpath>` を使う。
- **FastAPI の正本は `services/api`** — 旧 standalone repository へ修正を戻さない
  （ADR-0007）。
- **agent UI は shadcn/ui + Tailwind CSS** — Carbon は spec 009 §4 で完全撤去済み（ADR-0008）。
  `@carbon/react`・`@carbon/styles`・SCSS は `apps/web` に追加しない。
- **MCP は条件付き不採用** — 少数の in-process tool を維持し、複数ホスト再利用などの
  採用条件が成立した場合だけ再評価する（ADR-0001）。
- **耐久ワークフローは Inngest** — ジョブ orchestration の独自実装を増やさない（ADR-0005）。
- **IdP は環境選択、role はコード管理** — 認証プロバイダと権限決定を分離する（ADR-0006）。

## Conventions

- **Typing**: TypeScript は strict、型だけの import は `import type`。Python は公開境界を型付けし、
  `services/agent` は pyright strict、`services/api` は ty strict を使う。
- **Validation**: approval と agent API の request object は strict にする。意図的に拡張可能な
  AI SDK message part だけ `z.looseObject()` を使う。
- **Dependency injection**: agent/tool は `AgentDeps` を受け取り、時刻は `deps.now()` を使う。
  Python でも settings、store、model を境界から注入する。
- **Environment**: TS の env read は `@vaz/schemas/env`、Python は `Settings` / `get_settings()` に集約する。
- **Errors**: セキュリティ・監査の失敗はポリシーに従って fail-closed / fail-loud、
  補助的な observability は相関情報だけを残して fail-soft にできる。
- **Logging**: 生の user prompt、tool args、tool output、secret を通常 logger へ渡さない。
  tool arguments の保存先は Audit sink だけである。
- **AI SDK**: `inputSchema`、`isStepCount()`、`createUIMessageStreamResponse()` と
  `toUIMessageStream()` の v7 形を使う。
- **React**: React Compiler に任せ、手動の `useMemo` / `useCallback` を追加しない。
- **Commands**: `mise.toml` を先に確認し、`mise run <task>`、次に `uv run` / `pnpm exec` を使う。
- **Gate command**: TS workspace は `mise run check`。Python は変更レーンに応じて
  `mise run py:check` または `mise run api:check` を追加する。
- **Preflight command**: 共通 preflight はない。Docker、Redis、Ollama、外部モデルを使うレーンは、
  対応する `mise` task と opt-in marker の前提を確認する。

## Testing Strategy

- Unit は network を遮断し、時刻、model、store、transport を fake / mock へ差し替える。
- Integration は in-process transport や `FunctionModel` を使い、実 LLM を呼ばない。
- E2E はブラウザまたは実 HTTP protocol の境界を検証するが、通常 CI では外部モデルを要求しない。
- Evals と local Ollama lane は明示的 opt-in とし、ゼロ件成功を許さない。
- Contract drift は OpenAPI / JSON Schema snapshot と hand-written Zod schema の両側で検出する。
- テストは非空虚でなければならず、実装を壊したときに失敗することを確認する。

## Constraints

- Node 24 LTS、pnpm 12、TypeScript 6.x、Python 3.13 の宣言済み major を勝手に変更しない。
- LLM model ID は allowlist と明示済み fallback 以外へ hardcode しない。
- 埋め込み dimension は 768 固定。同一 corpus で provider/model を混在させない。
- Supervisor plan は `MAX_PLAN_STEPS` を超えさせない。上限変更はレビュー対象のコード変更とする。
- Client bundle の JS/CSS budget は `.size-limit.json` で検証し、測定なしに引き上げない。
- 依存追加、インフラ追加、major 更新は plan または ADR に根拠と撤去・再検討条件を記録する。
