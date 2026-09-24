"""E2E tests for context-budget recovery after a `budget_exceeded` stop.

Before this fix, a session whose persisted history alone was enough to trip
`usage_total_tokens_limit` stayed stuck at `stop_reason="budget_exceeded"`
forever: `save_history()` only ran on a `completed` turn, so `trim_history()`
never got a chance to shrink the offending history, and every subsequent
turn re-sent the same oversized history and hit the same wall (still
billing a full LLM call each time). `shrink_for_budget_recovery()`
(`app/stores/session_store/_trim.py`) is now applied on a `budget_exceeded`
stop in both `POST /agent/chat` (`app/api/v1/agent.py`) and
`POST /agent/stream` (`app/api/v1/_stream.py`), halving the stored history
so a following turn has a chance to fit under budget again.

Builds its own app via `create_app(settings=..., model=...)` (rather than the
shared `client` fixture) because these tests need a custom, growing-usage
`FunctionModel` and a tight `usage_total_tokens_limit` neither of which the
shared fixture configures.
"""

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport
from httpx import AsyncClient
from pydantic_ai.messages import ModelMessage
from pydantic_ai.messages import ModelResponse
from pydantic_ai.messages import TextPart
from pydantic_ai.models.function import AgentInfo
from pydantic_ai.models.function import DeltaToolCalls
from pydantic_ai.models.function import FunctionModel
from pydantic_ai.profiles import ModelProfile
from pydantic_ai.usage import RequestUsage

from app.main import create_app
from app.patterns.sse import parse_sse_events
from tests.conftest import build_test_settings


def _growing_usage_llm(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
    """Report input-token usage proportional to history length, like a real provider.

    A fixed-size reply plus growing input-token usage is what makes the
    session's cumulative token spend climb turn over turn until it trips
    `usage_total_tokens_limit`.
    """
    input_tokens = sum(len(str(m)) for m in messages) // 4
    return ModelResponse(
        parts=[TextPart(content="x" * 2000)],
        usage=RequestUsage(input_tokens=input_tokens, output_tokens=500),
    )


async def _growing_usage_llm_stream(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | DeltaToolCalls]:
    """Streaming counterpart of `_growing_usage_llm` for `POST /agent/stream`.

    `FunctionModel.request_stream` reports usage on its final chunk;
    `pydantic_ai`'s test harness sums this the same way `request()`'s
    `ModelResponse.usage` is summed for the non-streaming path.
    """
    yield "x" * 2000


@pytest.mark.asyncio
async def test_chat_session_recovers_from_budget_exceeded() -> None:
    """A session that hits `budget_exceeded` eventually completes again.

    Without the recovery-trim fix, every response from turn 9 onward stays
    `budget_exceeded` for the rest of the 28-turn run. With it, the session
    oscillates: a `budget_exceeded` turn halves the stored history, so the
    next turn(s) complete again until history grows back to the wall.
    """
    settings = build_test_settings(
        usage_total_tokens_limit=6000,
        llm_rate_limit="1000/minute",
    )
    model = FunctionModel(
        _growing_usage_llm,
        profile=ModelProfile(supports_json_schema_output=False),
    )
    app = create_app(settings=settings, model=model)

    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client,
    ):
        headers = {"X-API-Key": "test-api-key-12345"}
        session_id: str | None = None
        stop_reasons: list[str] = []
        for i in range(28):
            body: dict[str, str] = {"message": f"turn {i}"}
            if session_id:
                body["session_id"] = session_id
            response = await client.post("/v1/agent/chat", json=body, headers=headers)
            assert response.status_code == 200, response.json()
            data = response.json()
            session_id = data["session_id"]
            stop_reasons.append(data["stop_reason"])

    # The wall is hit at least once...
    assert "budget_exceeded" in stop_reasons
    # ...but the session keeps making progress afterward instead of bricking.
    first_budget_exceeded = stop_reasons.index("budget_exceeded")
    assert "completed" in stop_reasons[first_budget_exceeded + 1 :], stop_reasons


@pytest.mark.asyncio
async def test_stream_session_recovers_from_budget_exceeded() -> None:
    """Confirm `/agent/stream` recovers a session too, not just `/agent/chat`.

    The SSE `/agent/stream` endpoint applies the same recovery-trim on
    `budget_exceeded`, so a session seeded via `/agent/chat` and continued
    over `/agent/stream` also escapes the wall instead of bricking.
    """
    settings = build_test_settings(
        usage_total_tokens_limit=6000,
        llm_rate_limit="1000/minute",
    )
    model = FunctionModel(
        _growing_usage_llm,
        stream_function=_growing_usage_llm_stream,
        profile=ModelProfile(supports_json_schema_output=False),
    )
    app = create_app(settings=settings, model=model)

    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client,
    ):
        headers = {"X-API-Key": "test-api-key-12345"}

        # Seed a session and grow its history past the token wall via /agent/chat.
        session_id: str | None = None
        for i in range(15):
            body: dict[str, str] = {"message": f"seed {i}"}
            if session_id:
                body["session_id"] = session_id
            response = await client.post("/v1/agent/chat", json=body, headers=headers)
            data = response.json()
            session_id = data["session_id"]
            if data["stop_reason"] == "budget_exceeded":
                break
        assert session_id is not None

        # Continue the (now over-budget) session over the streaming endpoint.
        stream_stop_reasons: list[str] = []
        for _ in range(6):
            raw = ""
            async with client.stream(
                "POST",
                "/v1/agent/stream",
                json={"message": "continue", "session_id": session_id},
                headers=headers,
            ) as response:
                assert response.status_code == 200
                async for chunk in response.aiter_text():
                    raw += chunk
            events = parse_sse_events(raw)
            has_error = any(e.type == "error" for e in events)
            stream_stop_reasons.append("error" if has_error else "completed")

    # The streaming endpoint should not stay stuck erroring on every turn -
    # the recovery-trim gives later turns a chance to complete.
    assert "completed" in stream_stop_reasons, stream_stop_reasons
