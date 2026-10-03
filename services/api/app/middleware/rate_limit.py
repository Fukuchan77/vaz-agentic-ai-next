"""Rate limiting built directly on `limits` (no slowapi).

Two enforcement paths share one `RateLimiter`:

- `RateLimitMiddleware` counts every HTTP request against the global default
  limit. It is plain ASGI and runs before routing, so it never inspects
  `app.routes` - the route walk is what let fastapi 0.137's `_IncludedRouter`
  silently switch slowapi's global limit off.
- `enforce_llm_rate_limit` is a route dependency adding the stricter,
  configurable `llm_rate_limit` (Req 11.3) on LLM-invoking routes.

Both reach the same `RateLimiter.exceeded_response`, the only place a 429 is
built, so the flat `{message, code}` envelope (Req 1.1, 1.2) and its
`X-RateLimit-*` / delay-seconds `Retry-After` headers (Req 1.3) cannot diverge
between them. There is no handler-shape trap left either: slowapi swapped an
`async def` exception handler for its own `{"error": ...}` one, and nothing here
inspects the handler.

The verification record for this design (fastapi 0.142 / starlette 1.7, Redis
included) is `patterns/rate-limit/` in `Fukuchan77/pydantic-ai-sandbox`; this
module re-implements it rather than vendoring it.

At 500-999 lines this module is in the file-size policy's review band; not
split, because the client-identity walk (`get_client_identifier`), the
limiter, and its two enforcement paths are one unit - the 429 contract above
depends on all three sharing one `RateLimiter` - and it stays well under the
1000-line hard cap.
"""

import logging
import math
import time
from collections.abc import Callable
from dataclasses import dataclass
from functools import cache
from ipaddress import IPv4Network
from ipaddress import IPv6Network
from ipaddress import ip_address
from ipaddress import ip_network

import limits
from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse
from limits import RateLimitItem
from limits import WindowStats
from limits.aio.storage import MemoryStorage
from limits.aio.storage import Storage
from limits.aio.strategies import FixedWindowRateLimiter
from limits.storage import storage_from_string
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp
from starlette.types import Message
from starlette.types import Receive
from starlette.types import Scope
from starlette.types import Send

from app.config import Settings
from app.config import get_settings
from app.models.errors import ErrorResponse


logger = logging.getLogger(__name__)

RATE_LIMIT_MESSAGE = "Rate limit exceeded. Please try again later."
RATE_LIMIT_CODE = "RATE_LIMIT_EXCEEDED"

# How long the limiter stays on the in-memory fallback after the primary
# storage fails before it tries the primary again (Req 11.4).
_DEFAULT_RECOVERY_SECONDS = 30.0

# Extra key component for the per-route LLM limit, so its bucket can never be
# the global one even when both are configured to the same `<count>/<period>`
# (`limits` keys a window on the item's amount and period plus the identifiers).
_LLM_SCOPE = "llm"


@cache
def _parse_trusted_proxies(entries: tuple[str, ...]) -> tuple[IPv4Network | IPv6Network, ...]:
    """Parse trusted proxy entries into network objects.

    Entries are validated at settings load time
    (`SecuritySettingsMixin.validate_trusted_proxies`), so parsing cannot fail
    here. Cached because this runs on the hot path for every request.

    Args:
        entries: Tuple of IP address or CIDR network strings.

    Returns:
        tuple: Parsed network objects for containment checks.
    """
    return tuple(ip_network(entry, strict=False) for entry in entries)


def _is_trusted_proxy(client_ip: str, trusted_proxies: list[str]) -> bool:
    """Check whether `client_ip` falls inside any configured trusted proxy network.

    Accepts both bare addresses ("10.0.0.1") and CIDR networks ("10.0.0.0/8").
    CIDR support is load-bearing: `docs/production_deployment.md` configures
    whole ranges (an ALB's VPC CIDR, Cloudflare's 15 published ranges), and an
    exact string comparison never matches any of them - which would silently
    disable real-client-IP extraction for exactly the deployments the guide
    describes.

    Args:
        client_ip: The immediate client IP address (TCP connection source).
        trusted_proxies: Configured trusted proxy addresses or networks.

    Returns:
        bool: True if `client_ip` is inside any trusted network.
    """
    if not trusted_proxies:
        return False

    try:
        address = ip_address(client_ip)
    except ValueError:
        # Not a parseable address (e.g. the "unknown" placeholder below, or a
        # Unix-socket transport reporting a path) - never trusted.
        return False

    return any(address in network for network in _parse_trusted_proxies(tuple(trusted_proxies)))


def _resolve_settings(request: Request) -> Settings:
    """Resolve the `Settings` this request's application was built with.

    `app.state.settings` is authoritative: `create_app(settings=...)` injects an
    explicit instance, and reading process-global `get_settings()` instead would
    silently apply an environment-derived `trusted_proxies` to an application
    configured with a different one - while `enforce_llm_rate_limit`, in this
    same module, reads the injected instance for the limit itself. One
    rate-limit decision must not be assembled from two different `Settings`.

    The `get_settings()` fallback covers only an application whose lifespan has
    not populated `app.state` (bare `FastAPI()` harnesses in unit tests). It can
    never override an injected value, because it is reached only when there is
    none.

    Args:
        request: The incoming request, whose `app.state` is consulted first.

    Returns:
        Settings: The application's settings.
    """
    settings = getattr(request.app.state, "settings", None)
    if isinstance(settings, Settings):
        return settings
    return get_settings()


def get_client_identifier(request: Request) -> str:
    """Get client identifier considering proxy headers with trusted proxy validation.

    Only trust X-Forwarded-For header when the immediate client
    (request.client.host) falls inside the trusted_proxies allow-list. This
    prevents header spoofing attacks where untrusted clients set fake
    X-Forwarded-For values.

    When behind a trusted proxy or load balancer, `X-Forwarded-For` is a chain:
    `client, proxy1, proxy2`. Every proxy this repository documents *appends* to
    it (Nginx's `$proxy_add_x_forwarded_for`, an ALB, and Cloudflare all do), so
    the leftmost element is whatever the client itself sent - taking it would let
    any caller choose its own rate-limit bucket and rotate through unlimited
    ones. This function therefore walks the chain from the right, skipping hops
    that are themselves trusted proxies, and takes the first address that is not.
    That address is the closest hop the trusted infrastructure actually observed
    and is the last one an untrusted party could not have fabricated.

    Security:
        - Only trusts X-Forwarded-For when request comes from a trusted proxy
        - Accepts CIDR networks, so a documented VPC/CDN range actually matches
        - Walks the chain right-to-left, so a client-supplied leftmost entry
          cannot become the bucket key and rate limiting cannot be bypassed by
          spoofing the header
        - Empty trusted_proxies list means X-Forwarded-For is never trusted
        - Validates each element is an IP address before returning it as a
          bucket key, so a trusted proxy relaying a malformed header cannot
          create unbounded distinct rate-limit buckets

    Args:
        request: FastAPI request object

    Returns:
        str: Client identifier (IP address)
    """
    # Get trusted proxy configuration from the settings this app was built with
    settings = _resolve_settings(request)
    trusted_proxies = settings.trusted_proxies

    # Get the immediate client IP (the actual TCP connection source)
    direct_client_ip = request.client.host if request.client else "unknown"

    # Check for X-Forwarded-For header (set by proxies/load balancers)
    forwarded = request.headers.get("X-Forwarded-For")

    # Only trust X-Forwarded-For if the immediate client is a trusted proxy
    if forwarded and _is_trusted_proxy(direct_client_ip, trusted_proxies):
        for candidate in reversed([element.strip() for element in forwarded.split(",")]):
            try:
                ip_address(candidate)
            except ValueError:
                # A malformed element means the chain can no longer be walked
                # reliably - everything to its left is unverifiable. Stop here
                # rather than skipping past it, and fall back to the direct
                # connection IP below.
                break
            if not _is_trusted_proxy(candidate, trusted_proxies):
                return candidate
        # Every element was a trusted proxy (or the chain was unwalkable):
        # no untrusted client address is identifiable, so key on the peer.
        return direct_client_ip

    # Fall back to direct connection IP (ignore X-Forwarded-For from untrusted sources)
    return direct_client_ip


@dataclass(frozen=True, slots=True)
class RateLimitDecision:
    """The outcome of one counted hit against one limit.

    Attributes:
        allowed: Whether the hit fit inside the window.
        item: The limit the hit was counted against.
        stats: The window after the hit (remaining count and reset time).
    """

    allowed: bool
    item: RateLimitItem
    stats: WindowStats


class RateLimiter:
    """Count hits on `limits` storage and render the one shared 429.

    Owns what slowapi's `Limiter` used to: storage selection (Redis when
    configured, degrading to memory - Req 11.4), the fixed-window strategy
    slowapi defaulted to, and the 429 response itself.

    Args:
        default_limit: The limit `RateLimitMiddleware` counts every HTTP
            request against, in `limits` notation (``"1000/minute"``).
        key_func: Maps a request to its bucket key.
        storage_uri: A Redis URL (``redis://`` / ``rediss://``, or an explicit
            ``async+`` `limits` URI), or ``None`` for in-process memory.
        clock: Wall-clock seconds, used only for `Retry-After`.
        monotonic: Monotonic seconds, used only for the fallback cooldown.
        recovery_seconds: How long to stay on memory after the primary fails.
        storage: A primary storage to use directly (tests); overrides
            ``storage_uri``.
    """

    def __init__(
        self,
        default_limit: str,
        *,
        key_func: Callable[[Request], str],
        storage_uri: str | None = None,
        clock: Callable[[], float] = time.time,
        monotonic: Callable[[], float] = time.monotonic,
        recovery_seconds: float = _DEFAULT_RECOVERY_SECONDS,
        storage: Storage | None = None,
    ) -> None:
        """Parse the default limit and select the primary storage."""
        self.default_limit: RateLimitItem = limits.parse(default_limit)
        self.key_func = key_func
        self._clock = clock
        self._monotonic = monotonic
        self._recovery_seconds = recovery_seconds
        self._fallback = MemoryStorage()
        self._primary: Storage | None = storage or _primary_from_uri(storage_uri)
        self._degraded_until: float | None = None

    @property
    def degraded(self) -> bool:
        """Whether hits are currently counted on the in-memory fallback."""
        return self._degraded_until is not None

    async def hit(self, item: RateLimitItem, *identifiers: str) -> RateLimitDecision:
        """Count one hit against ``item`` for ``identifiers`` and read the window back.

        A primary-storage failure at any point - the first request after
        start-up included, so an unreachable Redis at boot needs no separate
        probe - moves counting to memory with one warning instead of failing
        the request. After ``recovery_seconds`` the next hit tries the
        primary again.

        Args:
            item: The limit to count against.
            *identifiers: The bucket key components, usually the client
                identifier plus an optional scope.

        Returns:
            RateLimitDecision: Whether the hit fit, and the window after it.
        """
        primary = self._primary
        if primary is not None and self._primary_available():
            try:
                return await _count(primary, item, identifiers)
            except Exception:  # any storage failure degrades, never 500s
                self._degrade()
        return await _count(self._fallback, item, identifiers)

    def headers(self, decision: RateLimitDecision, *, retry_after: bool) -> dict[str, str]:
        """Render the `X-RateLimit-*` headers for ``decision``.

        `X-RateLimit-Reset` is the window's reset time as integer epoch
        seconds, and `Retry-After` is delay-seconds, never an HTTP-date.

        Args:
            decision: The counted hit.
            retry_after: Add `Retry-After`. Only a 429 carries it; RFC 9110
                gives it no meaning on a 2xx.

        Returns:
            dict[str, str]: Header name to value.
        """
        reset_at = math.ceil(decision.stats.reset_time)
        headers = {
            "X-RateLimit-Limit": str(decision.item.amount),
            "X-RateLimit-Remaining": str(decision.stats.remaining),
            "X-RateLimit-Reset": str(reset_at),
        }
        if retry_after:
            headers["Retry-After"] = str(max(1, math.ceil(reset_at - self._clock())))
        return headers

    def exceeded_response(self, decision: RateLimitDecision) -> JSONResponse:
        """Build the 429 both enforcement paths return (Req 1.1-1.3).

        Args:
            decision: The hit that did not fit.

        Returns:
            JSONResponse: The flat `ErrorResponse` body with rate-limit headers.
        """
        body = ErrorResponse(message=RATE_LIMIT_MESSAGE, code=RATE_LIMIT_CODE)
        return JSONResponse(
            status_code=429,
            content=body.model_dump(),
            headers=self.headers(decision, retry_after=True),
        )

    def _primary_available(self) -> bool:
        if self._degraded_until is None:
            return True
        if self._monotonic() < self._degraded_until:
            return False
        logger.info("Retrying primary rate-limit storage")
        self._degraded_until = None
        return True

    def _degrade(self) -> None:
        logger.warning(
            "Rate limit storage unreachable - falling back to in-memory storage for %.0fs",
            self._recovery_seconds,
        )
        self._degraded_until = self._monotonic() + self._recovery_seconds


async def _count(
    storage: Storage, item: RateLimitItem, identifiers: tuple[str, ...]
) -> RateLimitDecision:
    strategy = FixedWindowRateLimiter(storage)
    allowed = await strategy.hit(item, *identifiers)
    stats = await strategy.get_window_stats(item, *identifiers)
    return RateLimitDecision(allowed=allowed, item=item, stats=stats)


def _primary_from_uri(storage_uri: str | None) -> Storage | None:
    """Build the primary async storage for ``storage_uri``.

    `Settings.redis_url` is a plain ``redis://`` URL shared with
    `RedisSessionStore`, so it is mapped to `limits`' async form here. The
    ``redispy`` implementation (``redis.asyncio``) keeps the limiter on the
    `redis` package this project already pins, rather than `limits`' default
    `coredis`; ``wrap_exceptions`` turns driver errors into
    `limits.errors.StorageError`, which `RateLimiter.hit` degrades on.

    Args:
        storage_uri: The configured URI, or ``None``.

    Returns:
        Storage | None: The async storage, or ``None`` for memory only.

    Raises:
        ValueError: If the URI does not resolve to an async storage.
    """
    if storage_uri is None:
        return None
    if storage_uri.startswith(("redis://", "rediss://")):
        storage_uri = f"async+{storage_uri}"
    options: dict[str, str | bool] = {}
    if storage_uri.startswith(("async+redis://", "async+rediss://")):
        options = {"implementation": "redispy", "wrap_exceptions": True}
    storage = storage_from_string(storage_uri, **options)
    if not isinstance(storage, Storage):
        msg = "rate-limit storage URI must resolve to an async storage"
        raise ValueError(msg)
    return storage


class RateLimitExceededError(Exception):
    """Raised by `enforce_llm_rate_limit`; carries the decision to render."""

    def __init__(self, decision: RateLimitDecision) -> None:
        """Keep the decision for the exception handler.

        Args:
            decision: The hit that did not fit.
        """
        super().__init__("rate limit exceeded")
        self.decision = decision


class RateLimitMiddleware:
    """Count every HTTP request against the limiter's default limit.

    Runs before routing, so every request is counted - included-router
    routes, and also paths that end in 404. The bucket is one per client
    across all routes; slowapi scoped its default limit per (client,
    endpoint), which needed exactly the route walk this avoids.

    Args:
        app: The wrapped ASGI application.
        limiter: The shared limiter (also `app.state.rate_limiter`).
    """

    def __init__(self, app: ASGIApp, limiter: RateLimiter) -> None:
        """Wrap ``app``."""
        self.app = app
        self.limiter = limiter

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Reject over-limit requests; stamp `X-RateLimit-*` on the rest.

        Args:
            scope: The ASGI connection scope.
            receive: The ASGI receive channel.
            send: The ASGI send channel.
        """
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limiter = self.limiter
        decision = await limiter.hit(limiter.default_limit, limiter.key_func(Request(scope)))
        if not decision.allowed:
            await limiter.exceeded_response(decision)(scope, receive, send)
            return

        headers = limiter.headers(decision, retry_after=False)

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                response_headers = MutableHeaders(scope=message)
                for name, value in headers.items():
                    # A per-route 429 already carries the stricter limit's
                    # headers; the global ones must not be appended beside them.
                    if name not in response_headers:
                        response_headers.append(name, value)
            await send(message)

        await self.app(scope, receive, send_with_headers)


def add_rate_limiting(
    app: FastAPI,
    default_limit: str = "60/minute",
    key_func: Callable[[Request], str] | None = None,
    storage_uri: str | None = None,
) -> RateLimiter:
    """Install rate limiting on ``app``: limiter state, middleware, and 429 handler.

    The middleware is added here, at the call site's position in the
    middleware stack, so `create_app` keeps the ordering it had with
    `SlowAPIMiddleware` (innermost of the stack it builds).

    Args:
        app: FastAPI application instance.
        default_limit: The global limit every HTTP request is counted against
            (e.g. ``"1000/minute"``).
        key_func: Function to extract the client identifier from a request
            (default: `get_client_identifier`).
        storage_uri: Storage backend URI (e.g. a Redis URL) so limits are
            shared across processes (Req 11.4). `None` uses in-memory storage,
            suitable for single-instance/development deployments. An
            unreachable store degrades to memory instead of failing requests.

    Returns:
        RateLimiter: The limiter both enforcement paths share.

    Example:
        ```python
        app = FastAPI()
        limiter = add_rate_limiting(app, default_limit="60/minute")
        ```
    """
    limiter = RateLimiter(
        default_limit,
        key_func=key_func or get_client_identifier,
        storage_uri=storage_uri,
    )
    app.state.rate_limiter = limiter
    app.add_middleware(RateLimitMiddleware, limiter=limiter)  # type: ignore[arg-type]

    async def rate_limit_exceeded_handler(request: Request, exc: Exception) -> JSONResponse:
        """Render `RateLimitExceededError` through the shared 429.

        `exc` is typed `Exception` to match `Starlette.add_exception_handler`'s
        signature; registration below guarantees the subclass.

        Args:
            request: The request that exceeded the limit.
            exc: The raised `RateLimitExceededError`.

        Returns:
            JSONResponse: The flat 429.
        """
        if not isinstance(exc, RateLimitExceededError):  # pragma: no cover - registration
            raise exc
        return get_rate_limiter(request).exceeded_response(exc.decision)

    app.add_exception_handler(RateLimitExceededError, rate_limit_exceeded_handler)
    return limiter


def get_rate_limiter(request: Request) -> RateLimiter:
    """Return the limiter `add_rate_limiting` stored on the request's app.

    Args:
        request: The incoming request.

    Returns:
        RateLimiter: The application's limiter.

    Raises:
        RuntimeError: If `add_rate_limiting` was never called on this app.
    """
    limiter = getattr(request.app.state, "rate_limiter", None)
    if not isinstance(limiter, RateLimiter):
        msg = "add_rate_limiting() has not been called on this application"
        raise RuntimeError(msg)
    return limiter


async def enforce_llm_rate_limit(request: Request) -> None:
    """Apply the stricter, configurable per-route limit to LLM-invoking endpoints (Req 11.3).

    Used as a route `dependencies=[Depends(enforce_llm_rate_limit)]` entry on
    `chat`/`stream_agent` (app/api/v1/agent.py) and `query` (app/api/v1/rag.py).

    Reuses `request.app.state.rate_limiter` - the same per-app limiter and
    storage `add_rate_limiting()` already wires to Redis when configured
    (Req 11.4) - rather than a second, independently-configured one. Its
    bucket is scoped apart from the global one, so the two never share a
    counter even when configured to the same limit.

    `Request` must stay a runtime import (not under `TYPE_CHECKING`): FastAPI
    resolves this signature at route registration, and an unresolvable
    annotation would turn `request` into a query parameter and silently skip
    the limit.

    Args:
        request: FastAPI request object.

    Raises:
        RateLimitExceededError: If `settings.llm_rate_limit` is exceeded;
            rendered by the handler `add_rate_limiting()` registers.
    """
    limiter = get_rate_limiter(request)
    settings = _resolve_settings(request)
    item = limits.parse(settings.llm_rate_limit)
    decision = await limiter.hit(item, limiter.key_func(request), _LLM_SCOPE)
    if not decision.allowed:
        raise RateLimitExceededError(decision)
