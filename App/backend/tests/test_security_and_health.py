"""Security posture tests: CORS lockdown + health endpoints.

Phase 1 hardening regression guard — the middleware config must never
regress to the wildcard-regex CORS that allowed credentialed cross-site
requests from any origin.
"""

import os
import sys
from pathlib import Path

os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from main import app, _resolve_cors_origins


def _cors_middleware():
    for mw in app.user_middleware:
        if mw.cls.__name__ == "CORSMiddleware":
            return mw
    raise AssertionError("CORSMiddleware not installed")


def test_cors_allowlist_never_wildcard():
    options = dict(_cors_middleware().kwargs)
    origins = options.get("allow_origins") or []
    regex = options.get("allow_origin_regex")
    credentials = options.get("allow_credentials")

    assert credentials is True
    assert "*" not in origins
    assert origins, "CORS allowlist must be non-empty"
    # The regex must be anchored to known preview hosts, never a bare ".*".
    assert regex is not None and regex != ".*"
    assert ".*" not in regex


def test_cors_resolves_configured_origins(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://beautyfit.app, https://beautyfit.online")
    # Re-import a fresh app module so the env change is picked up.
    import importlib

    mod = importlib.import_module("main")
    importlib.reload(mod)
    origins = mod._resolve_cors_origins()
    assert origins == ["https://beautyfit.app", "https://beautyfit.online"]


def test_cors_defaults_when_unset(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    import importlib

    mod = importlib.import_module("main")
    importlib.reload(mod)
    origins = mod._resolve_cors_origins()
    assert "http://localhost:5173" in origins
    assert "https://beautyfit.app" in origins


def test_cors_preflight_allowed_origin():
    client = TestClient(app)
    resp = client.options(
        "/api/v1/lipsticks",
        headers={
            "Origin": "https://beautyfit.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "https://beautyfit.app"


def test_root_and_health_endpoints():
    client = TestClient(app)
    assert client.get("/").status_code == 200
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "healthy"}


def _collect_paths(routes):
    """Recursively collect route paths, unwrapping lazy `_IncludedRouter`
    wrappers (FastAPI >= 0.115 defers router flattening)."""
    paths = set()
    for route in routes:
        path = getattr(route, "path", None)
        if path:
            paths.add(path)
        nested = getattr(route, "routes", None) or getattr(
            getattr(route, "original_router", None), "routes", None
        )
        if nested:
            paths |= _collect_paths(nested)
    return paths


def test_api_router_discovery_loaded_v1_routers():
    paths = _collect_paths(app.routes)
    for expected in (
        "/api/v1/auth/me",
        "/api/v1/payments/entitlement",
        "/api/v1/pro/tutorial",
        "/api/v1/lipsticks",
        "/api/v1/face-analysis/analyze-landmarks",
    ):
        assert expected in paths, f"Missing route {expected}"