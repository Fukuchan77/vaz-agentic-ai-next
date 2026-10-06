# Python ベータレーン取り込み証跡 (2026-10)

`pydantic-ai-sandbox` の `docs/hub-intake-2026-10.md` に記録された L1〜L4 の取り込み候補のうち、
H1・H2（slowapi 置き換え）は spec 008 ですでに取り込み済み。本ドキュメントは残る L1〜L4 の証跡を記録する。

仕様の参照先: `specs/009-agent-ui-and-beta-intake/spec.md` REQ-029〜REQ-033、DES-1.9。

---

## L1: `UsageLimits` と全体タイムアウト (REQ-029, REQ-030)

### 判定: **既充足** (spec 009 audit 2026-10)

#### 実装箇所

| 経路 | ファイル | 実装内容 |
|---|---|---|
| POST /v1/agent/chat | `app/api/v1/agent.py` | `UsageLimits(request_limit, total_tokens_limit, tool_calls_limit)` を `run_guarded()` に渡し、`asyncio.wait_for(timeout=settings.chat_request_timeout)` で全体を包む |
| POST /v1/agent/stream | `app/api/v1/_stream.py` | `event_source` → `_agent_event_stream` で同じ `UsageLimits` を適用。`_run_with_lifecycle_guards` がイベントごとに `sse_send_timeout` を掛ける |

#### budget/timeout と rate limit (429) の区別

3 つの停止経路は互いに別のステータスコード・本文を持ち、混同されない。

| 停止理由 | HTTP ステータス / SSE イベント | body フィールド | `Retry-After` |
|---|---|---|---|
| レート制限超過 | **429** | `ErrorResponse{message, code="RATE_LIMIT_EXCEEDED"}` | あり |
| chat タイムアウト (`asyncio.wait_for`) | **504** | `ErrorResponse{message="Chat request timed out", code="WORKFLOW_TIMEOUT"}` | なし |
| budget 超過 (chat) | **200** | `ChatResponse{stop_reason="budget_exceeded"}` | なし |
| stream タイムアウト (`sse_send_timeout`) | SSE `error` イベント | `Error{message="Stream timed out"}` | なし (SSE) |
| stream budget 超過 | SSE `error` イベント | `Error{message="Usage limit exceeded: budget_exceeded ..."}` | なし (SSE) |

429 は `app/middleware/rate_limit.py` の `RateLimiter.exceeded_response()` だけが生成する。
`UsageLimitExceeded` も `TimeoutError` も 429 を返さない。

既存のテスト証跡:
- `tests/unit/api/v1/test_agent_endpoints.py::TestChatEndpoint::test_chat_timeout_returns_504`
- `tests/unit/api/v1/test_stream_lifecycle.py::test_send_timeout_yields_terminal_error_and_stops`
- `tests/unit/api/v1/test_stream_lifecycle.py::TestUsageLimitExceededDetail`

**区別済み** — コード変更不要。

---

## L2: RAG 応答の引用 (REQ-030)

### 判定: **既充足** (spec 009 audit 2026-10)

#### 実装箇所

| ファイル | 実装内容 |
|---|---|
| `app/workflows/corrective_rag.py` | `order_hits()` で決定論的に並べた `RetrievedHit` を合成プロンプトへ渡す。合成結果の `cited_ids` を `validate_citations()` で照合 |
| `app/workflows/citation.py` | `validate_citations(cited_ids, hit_ids)` — 集合外があれば `DanglingCitationError` |
| `app/workflows/exceptions.py` | `DanglingCitationError` は `RAGWorkflowError` サブクラス。呼び出し元が 502 `UPSTREAM_GROUNDING_FAILED` にマップ |

#### 引用の構築方式

引用 ID はモデルが自由文に書くのではなく、同じリクエストで `query_with_scores()` が返した
`RetrievedHit.chunk_id` から構築される。`validate_citations` は取得済み ID の集合とだけ照合する。

- **集合外があれば**: `DanglingCitationError` → 502 fail-closed（集合外を除去して続行しない）
- **回答本文の自由文**: モデルが書く ID 風の文字列は `validate_citations` の照合対象**外**。
  引用として扱われるのは `cited_ids` として明示的に渡されたものだけ。
- **空の引用**: `EmptyCitationError` → 同様に fail-closed

既存のテスト証跡:
- `tests/unit/workflows/` 以下の citation 系テスト
- `tests/e2e/test_rag_citation_errors.py`

**既実装・fail-closed 確認済み** — コード変更不要。

---

## L3: ツール description とモデルへ公開するスキーマ (REQ-031)

### 判定: **充足** (spec 009 audit + inspection test 追加済み)

#### 監査結果

`services/api/app/agents/` に登録されているツールと構造化出力の一覧:

| 種別 | 名称 | ファイル | description の状態 |
|---|---|---|---|
| function tool | `mock_web_search` | `agents/tools_mock.py` | 本来の動作説明のみ（開発専用注記はコメントへ移動済み） |
| structured output | `ChatOutput` | `agents/chat_agent.py` | 開発者向けコメントは除去済み |
| structured output | `ChatOutput.reply` | `agents/chat_agent.py` | フィールド description はなく、Pydantic が型名のみ渡す |

`mock_web_search` のドキュメントには以前 `⚠️ WARNING` 注記が docstring にあったが、
`# DEV-ONLY STUB` コメントとして分離済みである（spec 009 task 6.2 で確認）。

inspection test の証跡:
- `tests/unit/agents/test_tools_mock.py::TestMockToolDescriptionSentToModel::test_description_and_param_docs_carry_no_developer_commentary`
- `tests/unit/agents/test_chat_output_description.py` (spec 009 task 6.2 で追加)

**充足済み**。

---

## L4: `Model.request()` の直接呼び出し一覧 (REQ-032)

### 判定: **充足** (spec 009 audit + inventory test 追加済み)

#### 一覧 (audit date: 2026-10)

| ファイル | 呼び出し箇所 | 意図 | ツール渡しの有無 |
|---|---|---|---|
| `app/api/health.py::_probe_llm_provider` | `model.request(_PROBE_MESSAGES, _PROBE_SETTINGS, ModelRequestParameters())` | LLM プロバイダーの疎通確認（readiness probe） | **なし** — 意図的 |

`Agent.run()` / `Agent.iter()` が `model.request()` を内部で呼ぶが、
それらは agent 経路であり直接呼び出しではない。
`_probe_llm_provider` のみが `Model.request()` を直接呼ぶ。

#### ツールを渡さない理由

readiness probe は「LLM プロバイダーが応答できるか」だけを確認する。
ツールスキーマを渡してもプロバイダーの疎通確認としては不要であり、
probe を単純・高速に保つため意図的に渡さない。
この呼び出しには `max_tokens: 1` が指定されており、最小コストの確認である。

inventory test の証跡:
- `tests/unit/test_model_request_inventory.py` (spec 009 task 6.3 で追加)

**充足済み**。

---

## REQ-033: sibling PR 報告

spec 009 task 6.3 の完了条件として、`pydantic-ai-sandbox` へ以下の PR を作成し、
本ドキュメントに URL と sibling commit を記録する。

| 項目 | 値 |
|---|---|
| PR URL | *(task 6.3 完了時に記録)* |
| sibling commit | *(task 6.3 完了時に記録)* |
| 対象ファイル | `../pydantic-ai-sandbox/docs/hub-intake-2026-10.md`、`../pydantic-ai-sandbox/specs/014-hub-python-beta-lane/traceability.md` |

---

*このドキュメントは spec 009 task 6.1〜6.3 の証跡として管理する。*
