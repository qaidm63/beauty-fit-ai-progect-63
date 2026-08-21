"""In-memory fixed-window rate limiter.

Limits the number of requests per client IP per minute to protect the backend
from abusive traffic (scraping, brute-force, free-tier cost spikes from the AI
endpoints).

Notes:
- The window is a per-process fixed minute bucket; behind multiple workers
  each process enforces its own limit. For multi-instance production, replace
  this with a shared store (e.g. Redis) — the interface stays identical.
- Client IP is taken from ``X-Forwarded-For`` only when ``RATE_LIMIT_TRUST_PROXY``
  is enabled, so direct deployments cannot be fooled by spoofed headers.
- Health/config endpoints are always exempt so uptime monitors and the
  frontend's runtime-config bootstrap are never blocked.
"""

import logging
import os
import threading
import time
from collections import defaultdict
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

_EXEMPT_PATHS = {
    "/",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/config",
}


def _env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _client_ip(request: Request) -> str:
    """Resolve the effective client IP, honoring proxy headers only when trusted."""
    if _env_bool("RATE_LIMIT_TRUST_PROXY", False):
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed-window per-IP request limiter returning 429 on overflow."""

    def __init__(
        self,
        app: Callable,
        *,
        max_requests_per_min: int | None = None,
        exempt_paths: set[str] | None = None,
    ) -> None:
        super().__init__(app)
        env_max = os.environ.get("MAX_REQUESTS_PER_IP_PER_MIN")
        self.max_requests_per_min = max_requests_per_min or (
            int(env_max) if env_max and env_max.strip().isdigit() else 60
        )
        if self.max_requests_per_min <= 0:
            self.max_requests_per_min = 60
        self.exempt_paths = exempt_paths or _EXEMPT_PATHS
        self._lock = threading.Lock()
        self._window_start = time.monotonic()
        self._counts: dict[str, int] = defaultdict(int)

    def _reset_if_needed(self, now: float) -> None:
        if now - self._window_start >= 60.0:
            self._window_start = now
            self._counts.clear()

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not _env_bool("RATE_LIMIT_ENABLED", True):
            return await call_next(request)

        path = request.url.path
        if path in self.exempt_paths:
            return await call_next(request)

        ip = _client_ip(request)
        now = time.monotonic()

        with self._lock:
            self._reset_if_needed(now)
            count = self._counts[ip] + 1
            if count > self.max_requests_per_min:
                logger.warning(
                    "Rate limit exceeded for ip=%s path=%s count=%d limit=%d",
                    ip,
                    path,
                    count,
                    self.max_requests_per_min,
                )
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Too many requests. Please slow down and try again."
                    },
                    headers={"Retry-After": "60"},
                )
            self._counts[ip] = count

        return await call_next(request)