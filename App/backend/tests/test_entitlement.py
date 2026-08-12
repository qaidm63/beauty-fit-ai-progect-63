"""Tests for the server-side Pro entitlement service."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from models.base import Base
from services.entitlement import (
    grant_entitlement,
    has_active_entitlement,
    get_active_entitlement,
    revoke_entitlement,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool


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


@pytest.mark.asyncio
async def test_grant_one_time_and_check_active(db_session):
    ent = await grant_entitlement(
        db_session,
        user_id="user-1",
        plan="one_time",
        stripe_session_id="cs_test_one",
        stripe_customer_id="cus_1",
    )
    assert ent is not None
    assert await has_active_entitlement(db_session, "user-1") is True
    assert await has_active_entitlement(db_session, "user-other") is False


@pytest.mark.asyncio
async def test_grant_is_idempotent_per_session(db_session):
    await grant_entitlement(
        db_session, user_id="user-1", plan="one_time", stripe_session_id="cs_same"
    )
    await grant_entitlement(
        db_session, user_id="user-1", plan="one_time", stripe_session_id="cs_same"
    )
    active = await get_active_entitlement(db_session, "user-1")
    assert active is not None
    assert active.stripe_session_id == "cs_same"


@pytest.mark.asyncio
async def test_monthly_entitlement_expiry(db_session):
    future = datetime.now(timezone.utc) + timedelta(days=20)
    await grant_entitlement(
        db_session,
        user_id="user-2",
        plan="monthly",
        stripe_session_id="cs_monthly",
        stripe_subscription_id="sub_1",
        expires_at=future,
    )
    assert await has_active_entitlement(db_session, "user-2") is True

    # Move expiry to the past -> no longer active.
    active = await get_active_entitlement(db_session, "user-2")
    assert active is not None
    active.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    await db_session.commit()
    assert await has_active_entitlement(db_session, "user-2") is False


@pytest.mark.asyncio
async def test_revoke_by_subscription(db_session):
    await grant_entitlement(
        db_session,
        user_id="user-3",
        plan="monthly",
        stripe_session_id="cs_sub",
        stripe_subscription_id="sub_99",
    )
    assert await has_active_entitlement(db_session, "user-3") is True

    await revoke_entitlement(db_session, stripe_subscription_id="sub_99")
    assert await has_active_entitlement(db_session, "user-3") is False


@pytest.mark.asyncio
async def test_reject_unknown_plan(db_session):
    with pytest.raises(ValueError):
        await grant_entitlement(
            db_session, user_id="user-4", plan="lifetime", stripe_session_id="cs_bad"
        )
