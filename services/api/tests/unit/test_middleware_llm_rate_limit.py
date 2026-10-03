"""Unit tests for the stricter, per-route LLM rate limit dependency (Req 11.3)."""

from fastapi import Depends
from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.middleware.rate_limit import add_rate_limiting
from app.middleware.rate_limit import enforce_llm_rate_limit
from tests.conftest import build_test_settings


def _build_app(llm_rate_limit: str, default_limit: str = "1000/minute") -> FastAPI:
    app = FastAPI()
    add_rate_limiting(app, default_limit=default_limit)
    app.state.settings = build_test_settings(llm_rate_limit=llm_rate_limit)

    @app.get("/llm-endpoint", dependencies=[Depends(enforce_llm_rate_limit)])
    async def llm_endpoint(request: Request) -> JSONResponse:
        return JSONResponse(content={"status": "ok"})

    return app


def test_enforce_llm_rate_limit_allows_requests_within_budget() -> None:
    """Requests within the configured llm_rate_limit succeed."""
    app = _build_app("3/minute")
    client = TestClient(app)

    for _ in range(3):
        response = client.get("/llm-endpoint")
        assert response.status_code == 200


def test_enforce_llm_rate_limit_blocks_requests_exceeding_budget() -> None:
    """A request past the configured llm_rate_limit is rejected with 429."""
    app = _build_app("3/minute")
    client = TestClient(app)

    for _ in range(3):
        response = client.get("/llm-endpoint")
        assert response.status_code == 200

    response = client.get("/llm-endpoint")
    assert response.status_code == 429
    body = response.json()
    assert set(body) == {"message", "code"}
    assert body["code"] == "RATE_LIMIT_EXCEEDED"
    assert "error" not in body
    assert "Retry-After" in response.headers
    assert "X-RateLimit-Limit" in response.headers


def test_enforce_llm_rate_limit_uses_configured_settings_value() -> None:
    """A stricter configured limit (1/minute) blocks the second request."""
    app = _build_app("1/minute")
    client = TestClient(app)

    first = client.get("/llm-endpoint")
    assert first.status_code == 200

    second = client.get("/llm-endpoint")
    assert second.status_code == 429


def test_llm_limit_429_carries_its_own_window_headers() -> None:
    """The per-route 429 reports the stricter limit, not the global one.

    The middleware stamps the global limit's headers only where the response
    does not already carry them, so a 429 from `enforce_llm_rate_limit` keeps
    `X-RateLimit-Limit` at the LLM limit's amount.
    """
    client = TestClient(_build_app("1/minute"))

    client.get("/llm-endpoint")
    response = client.get("/llm-endpoint")

    assert response.status_code == 429
    assert response.headers.get_list("X-RateLimit-Limit") == ["1"]


def test_llm_limit_has_its_own_bucket_even_when_equal_to_the_global_limit() -> None:
    """The LLM limit never shares a counter with the global one.

    `limits` keys a window on the limit's amount and period plus the
    identifiers, so with both set to `2/minute` an unscoped LLM hit would land
    in the global bucket and every LLM request would be counted twice - the
    second request would already be rejected. The scoped key keeps them apart:
    the global limit admits two requests and the third is its 429.
    """
    client = TestClient(_build_app("2/minute", default_limit="2/minute"))

    statuses = [client.get("/llm-endpoint").status_code for _ in range(3)]

    assert statuses == [200, 200, 429]


def test_llm_limit_without_add_rate_limiting_fails_loudly() -> None:
    """A route using the dependency on an app with no limiter is a 500, never a silent pass."""
    app = FastAPI()
    app.state.settings = build_test_settings(llm_rate_limit="1/minute")

    @app.get("/llm-endpoint", dependencies=[Depends(enforce_llm_rate_limit)])
    async def llm_endpoint() -> JSONResponse:
        return JSONResponse(content={"status": "ok"})

    response = TestClient(app, raise_server_exceptions=False).get("/llm-endpoint")

    assert response.status_code == 500
