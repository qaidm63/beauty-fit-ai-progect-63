"""End-to-end integration test: payment verify -> entitlement -> Pro gate.

Boots the real FastAPI app against a local SQLite database so the whole flow
(user token -> entitlement check -> grant -> Pro tutorial access) is exercised.
"""

import os
import sys
from pathlib import Path

# Force a local SQLite database before importing the app.
TEST_DB = Path(__file__).resolve().parent / "smoke_integration.db"
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB}"
os.environ["MGX_IGNORE_INIT_ADMIN"] = "1"
os.environ["MGX_IGNORE_INIT_DATA"] = "1"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from core.auth import create_access_token
from core.config import settings as app_settings
from httpx import ASGITransport, AsyncClient

# Force SQLite regardless of test ordering / cached settings.
app_settings.database_url = f"sqlite+aiosqlite:///{TEST_DB}"

pytestmark = pytest.mark.integration


async def test_payment_entitlement_pro_flow(monkeypatch):
    from main import app

    async def fake_generate_tutorial(req):
        return {
            "style": req.style,
            "overview": "Integration overview",
            "personalized_analysis": "Integration analysis",
            "steps": [],
            "sub_styles": [],
            "recommended_sub_style": None,
            "color_palette": [],
            "pro_tips": [],
            "simulation_prompt": "",
        }

    monkeypatch.setattr("routers.pro_tutorial.generate_pro_tutorial", fake_generate_tutorial)

    token = create_access_token(
        {"sub": "integration-user", "email": "int@example.com", "role": "user"}
    )
    auth_headers = {"Authorization": f"Bearer {token}"}

    async with app.router.lifespan_context(app):
        # The app's lifespan only inits the engine; create schema explicitly.
        from core.database import Base as MetadataBase, db_manager

        async with db_manager.engine.begin() as conn:
            await conn.run_sync(MetadataBase.metadata.create_all)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. No entitlement yet.
            resp = await client.get("/api/v1/payments/entitlement", headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["has_pro"] is False

            # 2. Pro tutorial is blocked before entitlement.
            resp = await client.post(
                "/api/v1/pro/tutorial", headers=auth_headers, json={"style": "sweet"}
            )
            assert resp.status_code == 403

            # 3. Simulate Stripe webhook / verify granting an entitlement.
            from core.database import db_manager
            from services.entitlement import grant_entitlement

            async with db_manager.async_session_maker() as session:
                await grant_entitlement(
                    session,
                    user_id="integration-user",
                    plan="one_time",
                    stripe_session_id="cs_integration",
                )

            # 4. Entitlement now visible.
            resp = await client.get("/api/v1/payments/entitlement", headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["has_pro"] is True
            assert resp.json()["plan"] == "one_time"

            # 5. Pro tutorial now allowed.
            resp = await client.post(
                "/api/v1/pro/tutorial", headers=auth_headers, json={"style": "sweet"}
            )
            assert resp.status_code == 200
            assert resp.json()["overview"] == "Integration overview"

    if TEST_DB.exists():
        TEST_DB.unlink()
