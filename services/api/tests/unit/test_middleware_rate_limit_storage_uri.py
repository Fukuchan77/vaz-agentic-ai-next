"""Unit tests for rate limiter storage_uri wiring and graceful fallback (Req 11.4)."""

import pytest
from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from limits.aio.storage import MemoryStorage
from limits.errors import StorageError

from app.middleware.rate_limit import RateLimiter
from app.middleware.rate_limit import add_rate_limiting
from app.middleware.rate_limit import get_client_identifier


def test_add_rate_limiting_defaults_to_in_memory_storage() -> None:
    """No storage_uri configured means requests still succeed (in-memory storage)."""
    app = FastAPI()
    add_rate_limiting(app, default_limit="3/minute")

    @app.get("/test")
    async def test_endpoint(request: Request) -> JSONResponse:
        return JSONResponse(content={"status": "ok"})

    client = TestClient(app)
    response = client.get("/test")
    assert response.status_code == 200


def test_add_rate_limiting_with_unreachable_redis_falls_back_to_memory() -> None:
    """An unreachable configured Redis storage_uri degrades to in-memory, not a crash.

    Port 1 is unassigned, so the connection is refused instantly (no real
    network needed, matching the `test_store_dry_run_startup.py` precedent for
    OllamaEmbeddingVectorStore) - `RateLimiter.hit` must catch that failure on
    the first request (there is no separate start-up probe) and let the request
    through rather than raising.
    """
    app = FastAPI()
    limiter = add_rate_limiting(
        app,
        default_limit="3/minute",
        storage_uri="redis://localhost:1/0",
    )

    @app.get("/test")
    async def test_endpoint(request: Request) -> JSONResponse:
        return JSONResponse(content={"status": "ok"})

    client = TestClient(app)
    response = client.get("/test")
    assert response.status_code == 200
    assert limiter.degraded


class _FlakyStorage(MemoryStorage):
    """In-memory storage that fails every `incr` while `failing` is set."""

    def __init__(self) -> None:
        super().__init__()
        self.failing = True
        self.calls = 0

    async def incr(self, *args: object, **kwargs: object) -> int:  # type: ignore[override]
        self.calls += 1
        if self.failing:
            raise StorageError(ConnectionError("primary down"))
        return await super().incr(*args, **kwargs)  # type: ignore[arg-type]


async def test_limiter_degrades_then_retries_primary_after_cooldown() -> None:
    """A failing primary moves counting to memory until the cooldown elapses (Req 11.4).

    Within the cooldown the primary is not touched at all (no per-request
    reconnect storm); after it, the next hit goes back to the primary.
    """
    now = [0.0]
    primary = _FlakyStorage()
    limiter = RateLimiter(
        "5/minute",
        key_func=get_client_identifier,
        storage=primary,
        monotonic=lambda: now[0],
        recovery_seconds=30.0,
    )
    item = limiter.default_limit

    first = await limiter.hit(item, "client")
    assert first.allowed
    assert limiter.degraded
    assert primary.calls == 1

    now[0] = 10.0
    await limiter.hit(item, "client")
    assert primary.calls == 1, "primary must not be retried inside the cooldown"

    primary.failing = False
    now[0] = 31.0
    recovered = await limiter.hit(item, "client")
    assert recovered.allowed
    assert not limiter.degraded
    assert primary.calls == 2


def test_rate_limiter_rejects_a_sync_storage_uri() -> None:
    """A `limits` URI without the `async+` scheme is refused at construction."""
    with pytest.raises(ValueError, match="async storage"):
        RateLimiter("1/minute", key_func=get_client_identifier, storage_uri="memory://")
