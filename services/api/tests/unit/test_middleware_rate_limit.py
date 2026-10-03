"""Unit tests for rate limiting middleware."""

import time

import pytest
from fastapi import APIRouter
from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.middleware.rate_limit import add_rate_limiting


@pytest.fixture
def app_with_rate_limit() -> FastAPI:
    """Create a FastAPI app with rate limiting for testing."""
    app = FastAPI()

    # Add rate limiting with test configuration
    # Use a very low limit for testing: 3 requests per minute
    add_rate_limiting(app, default_limit="3/minute")

    @app.get("/test")
    async def test_endpoint(request: Request) -> JSONResponse:
        return JSONResponse(content={"status": "ok"})

    @app.get("/other")
    async def other_endpoint() -> JSONResponse:
        return JSONResponse(content={"status": "ok"})

    return app


@pytest.fixture
def client(app_with_rate_limit: FastAPI) -> TestClient:
    """Create test client."""
    return TestClient(app_with_rate_limit)


def test_rate_limit_allows_requests_within_limit(client: TestClient) -> None:
    """Test that requests within rate limit are allowed."""
    # First 3 requests should succeed
    for _ in range(3):
        response = client.get("/test")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


def test_rate_limit_blocks_requests_exceeding_limit(client: TestClient) -> None:
    """Test that requests exceeding rate limit are blocked with 429."""
    # First 3 requests succeed
    for _ in range(3):
        response = client.get("/test")
        assert response.status_code == 200

    # 4th request should be rate limited
    response = client.get("/test")
    assert response.status_code == 429
    # Our custom error handler returns ErrorResponse with "message" and "code" fields
    assert "message" in response.json()
    assert response.json()["code"] == "RATE_LIMIT_EXCEEDED"


def test_rate_limit_headers_included_in_response(client: TestClient) -> None:
    """Test that rate limit headers are included in responses."""
    response = client.get("/test")

    assert response.status_code == 200
    # Check for standard rate limit headers
    assert "X-RateLimit-Limit" in response.headers
    assert "X-RateLimit-Remaining" in response.headers
    assert "X-RateLimit-Reset" in response.headers


def test_rate_limit_remaining_decreases(client: TestClient) -> None:
    """Test that X-RateLimit-Remaining decreases with each request."""
    # First request
    response1 = client.get("/test")
    remaining1 = int(response1.headers["X-RateLimit-Remaining"])

    # Second request
    response2 = client.get("/test")
    remaining2 = int(response2.headers["X-RateLimit-Remaining"])

    # Remaining should decrease
    assert remaining2 == remaining1 - 1


def test_rate_limit_bucket_is_shared_across_routes(client: TestClient) -> None:
    """The global limit is one bucket per client across all routes.

    Deliberate difference from slowapi, which scoped its default limit per
    (client, endpoint): that needed a walk of `app.routes`, the exact walk
    fastapi 0.137's `_IncludedRouter` broke. Requests to `/other` (no
    per-route limit of its own) therefore spend the same budget as `/test`.
    """
    for _ in range(3):
        assert client.get("/other").status_code == 200

    response = client.get("/test")
    assert response.status_code == 429


def test_global_rate_limit_counts_included_router_routes() -> None:
    """Routes mounted through `include_router` are counted (the fastapi>=0.137 canary).

    fastapi 0.137 wraps included routers in `_IncludedRouter`; slowapi's route
    walk stopped finding their endpoints and exempted every such request. Every
    route this service serves is mounted this way (`app/api/v1/router.py`).
    """
    router = APIRouter()

    @router.get("/inner")
    async def inner() -> dict[str, bool]:
        return {"ok": True}

    outer = APIRouter(prefix="/v1")
    outer.include_router(router)

    app = FastAPI()
    add_rate_limiting(app, default_limit="2/minute")
    app.include_router(outer)
    client = TestClient(app)

    statuses = [client.get("/v1/inner").status_code for _ in range(3)]

    assert statuses == [200, 200, 429]


def test_global_rate_limit_counts_unmatched_paths() -> None:
    """A path that ends in 404 still spends budget: counting happens before routing."""
    app = FastAPI()
    add_rate_limiting(app, default_limit="1/minute")
    client = TestClient(app)

    assert client.get("/missing").status_code == 404
    assert client.get("/missing").status_code == 429


def test_rate_limit_ignores_non_http_scopes() -> None:
    """Lifespan (and any non-HTTP) scopes pass through without being counted."""
    app = FastAPI()
    add_rate_limiting(app, default_limit="1/minute")

    @app.get("/ok")
    async def ok() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(app) as client:  # runs the lifespan scope through the middleware
        assert client.get("/ok").status_code == 200


def test_rate_limit_reset_after_window() -> None:
    """Test that rate limit resets after the time window expires.

    Uses its own 3/second-limited app rather than the shared `client`
    fixture's 3/minute one: `X-RateLimit-Reset` holds the window's real reset
    timestamp (Req 1.3), and a 1-minute window would make this test sleep for
    up to a minute.
    """
    app = FastAPI()
    add_rate_limiting(app, default_limit="3/second")

    @app.get("/fast")
    async def fast_endpoint(request: Request) -> JSONResponse:
        return JSONResponse(content={"status": "ok"})

    client = TestClient(app)

    for _ in range(3):
        response = client.get("/fast")
        assert response.status_code == 200

    response = client.get("/fast")
    assert response.status_code == 429

    # `X-RateLimit-Reset` is a real epoch timestamp (integer seconds), not
    # the always-0 fallback an old, dead header-computation code path left
    # behind.
    reset_time = float(response.headers["X-RateLimit-Reset"])
    current_time = time.time()
    wait_time = reset_time - current_time + 1  # 1s buffer

    assert 0 < wait_time < 5, f"expected a bounded ~1s wait for a 1-second window, got {wait_time}"
    time.sleep(wait_time)

    # After reset, request should succeed
    response = client.get("/fast")
    assert response.status_code == 200
