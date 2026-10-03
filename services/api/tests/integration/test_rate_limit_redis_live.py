"""Integration tests: the rate limiter's `limits.aio` storage against a real Redis (Req 11.4).

The limiter reaches Redis through `limits.aio`'s `redispy` implementation
(`redis.asyncio`), not the synchronous client slowapi used, so this module is
where that async path runs against a real server. Gated like
`test_redis_session_store_live.py` - a live PING probe, no in-process substitute.
"""

import uuid
from collections.abc import Callable

import pytest
from fastapi import FastAPI
from fastapi import Request
from httpx import ASGITransport
from httpx import AsyncClient

from app.middleware.rate_limit import RateLimiter
from app.middleware.rate_limit import add_rate_limiting
from tests.support.redis import REDIS_UNREACHABLE_SKIP_REASON
from tests.support.redis import REDIS_URL
from tests.support.redis import redis_reachable


pytestmark = pytest.mark.redis


@pytest.fixture(autouse=True)
async def _require_redis() -> None:
    """Skip every test in this module unless a real Redis server answers PING."""
    if not await redis_reachable():
        pytest.skip(REDIS_UNREACHABLE_SKIP_REASON)


def _unique_key_func() -> tuple[str, Callable[[Request], str]]:
    """Build a bucket key unique to this test invocation, avoiding cross-run collisions."""
    key = f"test-rate-limit-live-{uuid.uuid4().hex}"

    def key_func(request: Request) -> str:
        return key

    return key, key_func


async def test_two_limiters_share_one_redis_bucket() -> None:
    """Two limiters (two processes, in production) count into the same Redis window."""
    key, key_func = _unique_key_func()
    first = RateLimiter("2/minute", key_func=key_func, storage_uri=REDIS_URL)
    second = RateLimiter("2/minute", key_func=key_func, storage_uri=REDIS_URL)

    assert (await first.hit(first.default_limit, key)).allowed
    assert (await second.hit(second.default_limit, key)).allowed
    third = await first.hit(first.default_limit, key)

    assert not third.allowed
    assert not first.degraded
    assert not second.degraded


async def test_global_limit_returns_flat_429_on_redis_storage() -> None:
    """The middleware's 429 is the same flat envelope when counted on Redis."""
    _, key_func = _unique_key_func()
    app = FastAPI()
    limiter = add_rate_limiting(
        app,
        default_limit="1/minute",
        key_func=key_func,
        storage_uri=REDIS_URL,
    )

    @app.get("/limited")
    async def limited() -> dict[str, bool]:
        return {"ok": True}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/limited")).status_code == 200
        response = await client.get("/limited")

    assert response.status_code == 429
    assert response.json() == {
        "message": "Rate limit exceeded. Please try again later.",
        "code": "RATE_LIMIT_EXCEEDED",
    }
    assert "Retry-After" in response.headers
    assert not limiter.degraded
