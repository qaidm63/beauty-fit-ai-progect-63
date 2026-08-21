"""Tests for the in-memory rate limiting middleware."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from middlewares.rate_limit import RateLimitMiddleware, _client_ip

os.environ["RATE_LIMIT_ENABLED"] = "true"


def _build_app(limit: int = 3, exempt: set[str] | None = None):
    async def endpoint(request):
        return JSONResponse({"ok": True})

    async def health(request):
        return JSONResponse({"status": "healthy"})

    routes = [
        Route("/api/test", endpoint),
        Route("/health", health),
    ]
    app = Starlette(routes=routes)
    app.add_middleware(RateLimitMiddleware, max_requests_per_min=limit, exempt_paths=exempt)
    return app


def test_allows_requests_under_limit():
    client = TestClient(_build_app(limit=3))
    for _ in range(3):
        resp = client.get("/api/test")
        assert resp.status_code == 200


def test_returns_429_above_limit():
    client = TestClient(_build_app(limit=3))
    for _ in range(3):
        assert client.get("/api/test").status_code == 200
    resp = client.get("/api/test")
    assert resp.status_code == 429
    assert resp.headers.get("retry-after") == "60"
    assert "Too many requests" in resp.text


def test_exempt_paths_are_not_counted():
    app = _build_app(limit=1)
    client = TestClient(app)
    assert client.get("/health").status_code == 200
    # Exempt requests must not consume the budget.
    assert client.get("/health").status_code == 200
    # First counted request still allowed...
    assert client.get("/api/test").status_code == 200
    # ...and the second is blocked.
    assert client.get("/api/test").status_code == 429


def test_limiter_disabled_via_env(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    client = TestClient(_build_app(limit=1))
    for _ in range(5):
        assert client.get("/api/test").status_code == 200


def test_client_ip_respects_trust_proxy_flag(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_TRUST_PROXY", "false")

    from starlette.requests import Request as StarletteRequest

    scope = {
        "type": "http",
        "client": ("203.0.113.7", 54321),
        "headers": [(b"x-forwarded-for", b"198.51.100.9")],
        "method": "GET",
        "path": "/api/test",
        "query_string": b"",
        "scheme": "http",
        "server": ("testserver", 80),
    }
    req = StarletteRequest(scope)
    assert _client_ip(req) == "203.0.113.7"

    monkeypatch.setenv("RATE_LIMIT_TRUST_PROXY", "true")
    assert _client_ip(req) == "198.51.100.9"