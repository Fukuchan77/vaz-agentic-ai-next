"""Regression test for the global rate limit's 429 envelope (Req 1.1, 1.2, 1.3, 1.6).

Covers the middleware path specifically: a route with no per-route limit is
checked only by `RateLimitMiddleware`. That is the path that shipped broken
under slowapi, whose `SlowAPIMiddleware` silently swapped an `async def`
handler for its own `{"error": ...}` one. The middleware now builds its 429
through `RateLimiter.exceeded_response` directly, so this test pins that the
flat `{message, code}` contract holds without any exception handler involved.
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.middleware.rate_limit import add_rate_limiting


def _client() -> TestClient:
    """Build a client whose only route is limited exclusively by the middleware.

    Returns:
        TestClient: A second request within the window yields 429.
    """
    app = FastAPI()
    add_rate_limiting(app, default_limit="1/minute")

    @app.get("/undecorated")
    async def _undecorated() -> JSONResponse:
        return JSONResponse(content={"ok": True})

    return TestClient(app)


def test_global_rate_limit_429_is_flat_with_no_error_key() -> None:
    """The global limit's 429 body holds exactly `message` and `code` (Req 1.1, 1.2)."""
    client = _client()
    client.get("/undecorated")
    response = client.get("/undecorated")

    assert response.status_code == 429
    body = response.json()
    assert set(body) == {"message", "code"}
    assert body["code"] == "RATE_LIMIT_EXCEEDED"
    assert "error" not in body


def test_global_rate_limit_429_carries_rate_limit_headers() -> None:
    """The global limit's 429 carries `X-RateLimit-Limit` and `Retry-After` (Req 1.3)."""
    client = _client()
    client.get("/undecorated")
    response = client.get("/undecorated")

    assert response.status_code == 429
    assert "X-RateLimit-Limit" in response.headers
    assert "Retry-After" in response.headers


def test_global_rate_limit_success_carries_no_retry_after() -> None:
    """A 2xx carries `X-RateLimit-*` but no `Retry-After` (meaningless on a 2xx, RFC 9110)."""
    response = _client().get("/undecorated")

    assert response.status_code == 200
    assert "X-RateLimit-Remaining" in response.headers
    assert "Retry-After" not in response.headers
