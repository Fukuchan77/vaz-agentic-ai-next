"""Unit tests for the SSE stream lifecycle guards (app/api/v1/_stream.py).

Exercises `_run_with_lifecycle_guards()` directly against fake async event
sources so the cap/disconnect/timeout/cancel/error/aclose mechanics can be
verified deterministically, without depending on pydantic-ai internals.
"""

import asyncio
from collections.abc import AsyncGenerator

import pytest
from pydantic_ai import RunUsage
from pydantic_ai import UsageLimitExceeded
from pydantic_ai.messages import ModelRequest
from pydantic_ai.messages import ModelResponse
from pydantic_ai.messages import SystemPromptPart
from pydantic_ai.messages import TextPart
from pydantic_ai.messages import UserPromptPart

from app.api.v1._stream import _run_with_lifecycle_guards
from app.patterns.sse import Completed
from app.patterns.sse import Error
from app.patterns.sse import SSEEvent
from app.patterns.sse import Token
from app.patterns.sse import parse_sse_events
from app.stores.session_store.in_memory import InMemorySessionStore
from tests.conftest import build_test_settings


class _FakeRequest:
    """Minimal stand-in for fastapi.Request exposing only is_disconnected()."""

    def __init__(self, *, disconnected: bool = False) -> None:
        self._disconnected = disconnected

    async def is_disconnected(self) -> bool:
        return self._disconnected


class _TrackingAsyncGen:
    """Wraps an async generator of SSEEvents and records whether aclose() was called."""

    def __init__(self, agen: AsyncGenerator[SSEEvent]) -> None:
        self._agen = agen
        self.closed = False

    def __aiter__(self) -> "_TrackingAsyncGen":
        return self

    async def __anext__(self) -> SSEEvent:
        return await self._agen.__anext__()

    async def aclose(self) -> None:
        self.closed = True
        await self._agen.aclose()


async def _events(*events: SSEEvent) -> AsyncGenerator[SSEEvent]:
    for event in events:
        yield event


async def _hanging_forever() -> AsyncGenerator[SSEEvent]:
    await asyncio.Event().wait()
    yield Token(content="unreachable")  # pragma: no cover


async def _raises(exc: BaseException) -> AsyncGenerator[SSEEvent]:
    raise exc
    yield Token(content="unreachable")  # pragma: no cover


@pytest.mark.asyncio
async def test_yields_sse_wire_text_for_each_event() -> None:
    """Each upstream event is serialized to SSE wire text via to_sse()."""
    settings = build_test_settings()
    agen = _TrackingAsyncGen(_events(Token(content="a"), Completed()))

    wires = [w async for w in _run_with_lifecycle_guards(_FakeRequest(), agen, settings)]

    parsed = parse_sse_events("".join(wires))
    assert parsed == [Token(content="a"), Completed()]


@pytest.mark.asyncio
async def test_aclose_called_on_normal_completion() -> None:
    """The underlying async generator is closed after normal exhaustion."""
    settings = build_test_settings()
    agen = _TrackingAsyncGen(_events(Completed()))

    async for _ in _run_with_lifecycle_guards(_FakeRequest(), agen, settings):
        pass

    assert agen.closed


@pytest.mark.asyncio
async def test_stops_when_client_disconnected() -> None:
    """When request.is_disconnected() is True, no events are emitted and agen is closed."""
    settings = build_test_settings()
    agen = _TrackingAsyncGen(_events(Token(content="never seen")))

    wires = [
        w async for w in _run_with_lifecycle_guards(_FakeRequest(disconnected=True), agen, settings)
    ]

    assert wires == []
    assert agen.closed


@pytest.mark.asyncio
async def test_stops_producing_further_events_at_sse_max_events_cap() -> None:
    """Once sse_max_events is reached, the stream stops even if more events remain."""
    settings = build_test_settings(sse_max_events=2)
    agen = _TrackingAsyncGen(_events(Token(content="a"), Token(content="b"), Token(content="c")))

    wires = [w async for w in _run_with_lifecycle_guards(_FakeRequest(), agen, settings)]

    parsed = parse_sse_events("".join(wires))
    assert parsed == [Token(content="a"), Token(content="b")]
    assert agen.closed


@pytest.mark.asyncio
async def test_terminal_error_event_on_unexpected_exception() -> None:
    """An unexpected exception mid-stream yields a generic terminal error event."""
    settings = build_test_settings()
    agen = _TrackingAsyncGen(_raises(RuntimeError("boom")))

    wires = [w async for w in _run_with_lifecycle_guards(_FakeRequest(), agen, settings)]

    parsed = parse_sse_events("".join(wires))
    assert parsed == [Error(message="An unexpected error occurred")]
    assert agen.closed


@pytest.mark.asyncio
async def test_cancelled_error_is_re_raised_after_cleanup() -> None:
    """Cancelling the stream's own consumer re-raises CancelledError and closes agen.

    Models a real client disconnect: the task iterating `_run_with_lifecycle_guards`
    gets cancelled while waiting on an event that never arrives.
    """
    settings = build_test_settings()
    agen = _TrackingAsyncGen(_hanging_forever())

    async def consume() -> None:
        async for _ in _run_with_lifecycle_guards(_FakeRequest(), agen, settings):
            pass

    task = asyncio.ensure_future(consume())
    await asyncio.sleep(0.05)  # let the producer start waiting on the hanging agen
    task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await task

    assert agen.closed


@pytest.mark.asyncio
async def test_send_timeout_yields_terminal_error_and_stops() -> None:
    """A single event that never arrives within sse_send_timeout aborts with an error."""
    settings = build_test_settings(sse_send_timeout=1, sse_heartbeat_interval=1)
    agen = _TrackingAsyncGen(_hanging_forever())

    wires = [w async for w in _run_with_lifecycle_guards(_FakeRequest(), agen, settings)]

    parsed = parse_sse_events("".join(wires))
    assert parsed == [Error(message="Stream timed out")]
    assert agen.closed


@pytest.mark.asyncio
async def test_no_events_emitted_after_error() -> None:
    """Once an error event is yielded, no further events (e.g. from cap) are produced."""
    settings = build_test_settings()
    agen = _TrackingAsyncGen(_raises(ValueError("nope")))

    wires = [w async for w in _run_with_lifecycle_guards(_FakeRequest(), agen, settings)]

    assert len(wires) == 1
    assert "error" in wires[0]


class TestUsageLimitExceededDetail:
    """Req 9.4: a UsageLimitExceeded reports the observed usage snapshot when given one.

    `usage` is plumbed in from the caller (`event_source`) rather than owned
    here, so these tests exercise the message-formatting contract directly
    against a scripted `RunUsage`, decoupled from a real Agent run.
    """

    @pytest.mark.asyncio
    async def test_error_message_includes_the_usage_snapshot_when_usage_is_given(self) -> None:
        """The terminal Error message reports requests/tool_calls/total_tokens."""
        settings = build_test_settings()
        agen = _TrackingAsyncGen(
            _raises(UsageLimitExceeded("The next request would exceed the request_limit of 1"))
        )
        usage = RunUsage(requests=3, tool_calls=1, input_tokens=40, output_tokens=10)

        wires = [
            w async for w in _run_with_lifecycle_guards(_FakeRequest(), agen, settings, usage=usage)
        ]

        parsed = parse_sse_events("".join(wires))
        assert len(parsed) == 1
        error = parsed[0]
        assert isinstance(error, Error)
        assert "max_iterations" in error.message
        assert "requests=3" in error.message
        assert "tool_calls=1" in error.message
        assert "total_tokens=50" in error.message

    @pytest.mark.asyncio
    async def test_error_message_omits_the_snapshot_when_no_usage_is_given(self) -> None:
        """Without a usage object, the message stays the plain stop-reason text."""
        settings = build_test_settings()
        agen = _TrackingAsyncGen(
            _raises(UsageLimitExceeded("Exceeded the total_tokens_limit of 10"))
        )

        wires = [w async for w in _run_with_lifecycle_guards(_FakeRequest(), agen, settings)]

        parsed = parse_sse_events("".join(wires))
        assert parsed == [Error(message="Usage limit exceeded: budget_exceeded")]


def _long_history() -> list:
    """A history long enough that `shrink_for_budget_recovery` actually cuts it."""
    messages: list = [ModelRequest(parts=[SystemPromptPart(content="sys")])]
    for i in range(9):
        messages.append(ModelRequest(parts=[UserPromptPart(content=f"u{i}")]))
        messages.append(ModelResponse(parts=[TextPart(content=f"a{i}")]))
    return messages


class TestBudgetExceededRecovery:
    """Verify recovery-trim on a `budget_exceeded` `UsageLimitExceeded`.

    It halves and persists the stored history so a following turn has a
    chance to escape the wall, mirroring the non-streaming `/agent/chat`
    recovery path in `app.api.v1.agent`.
    """

    @pytest.mark.asyncio
    async def test_shrinks_and_saves_history_on_budget_exceeded(self) -> None:
        """`session_store.save_history` is called with a strictly shorter history."""
        settings = build_test_settings()
        agen = _TrackingAsyncGen(
            _raises(UsageLimitExceeded("Exceeded the total_tokens_limit of 10"))
        )
        session_store = InMemorySessionStore()
        history = _long_history()
        await session_store.save_history("sess-1", history)

        wires = [
            w
            async for w in _run_with_lifecycle_guards(
                _FakeRequest(),
                agen,
                settings,
                session_store=session_store,
                session_id="sess-1",
                history=history,
            )
        ]

        parsed = parse_sse_events("".join(wires))
        assert parsed == [Error(message="Usage limit exceeded: budget_exceeded")]
        recovered = await session_store.get_history("sess-1")
        assert len(recovered) < len(history)

    @pytest.mark.asyncio
    async def test_does_not_touch_history_on_a_non_budget_stop(self) -> None:
        """A `max_iterations`/`request_limit` stop leaves the stored history untouched."""
        settings = build_test_settings()
        agen = _TrackingAsyncGen(
            _raises(UsageLimitExceeded("The next request would exceed the request_limit of 1"))
        )
        session_store = InMemorySessionStore()
        history = _long_history()
        await session_store.save_history("sess-2", history)

        async for _ in _run_with_lifecycle_guards(
            _FakeRequest(),
            agen,
            settings,
            session_store=session_store,
            session_id="sess-2",
            history=history,
        ):
            pass

        recovered = await session_store.get_history("sess-2")
        assert recovered == history

    @pytest.mark.asyncio
    async def test_omitted_session_args_disable_recovery(self) -> None:
        """Recovery is a no-op without `session_store`/`session_id`/`history`.

        This is what every pre-existing caller in this file relies on.
        """
        settings = build_test_settings()
        agen = _TrackingAsyncGen(
            _raises(UsageLimitExceeded("Exceeded the total_tokens_limit of 10"))
        )

        wires = [w async for w in _run_with_lifecycle_guards(_FakeRequest(), agen, settings)]

        parsed = parse_sse_events("".join(wires))
        assert parsed == [Error(message="Usage limit exceeded: budget_exceeded")]
