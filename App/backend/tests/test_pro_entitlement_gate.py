"""Tests for the Pro entitlement gate on the /api/v1/pro endpoints."""

import os
import sys
from pathlib import Path

import pytest

# Disable the dev bypass so the tests exercise the real entitlement gate.
os.environ["ENVIRONMENT"] = "test"
os.environ["DEV_BYPASS_STRIPE"] = "false"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from models.base import Base
from routers.pro_tutorial import require_pro_entitlement
from schemas.auth import UserResponse
from services.entitlement import grant_entitlement
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

TEST_USER = UserResponse(id="test-user", email="t@example.com", name="Tester", role="user")


@pytest.fixture
async def db_session():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        yield session
    await engine.dispose()


async def test_require_pro_entitlement_denies_without_grant(db_session):
    with pytest.raises(HTTPException) as exc_info:
        await require_pro_entitlement(current_user=TEST_USER, db=db_session)
    assert exc_info.value.status_code == 403
    assert "Pro access required" in exc_info.value.detail


async def test_require_pro_entitlement_allows_after_grant(db_session):
    await grant_entitlement(
        db_session,
        user_id=TEST_USER.id,
        plan="one_time",
        stripe_session_id="cs_gate_test",
    )
    user = await require_pro_entitlement(current_user=TEST_USER, db=db_session)
    assert user.id == TEST_USER.id
