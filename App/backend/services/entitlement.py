"""Entitlement service — authoritative server-side Pro access management.

Granting/checking Pro access is centralized here. Every grant is tied to a
Stripe session ID so webhook replay and double verification are idempotent.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from models.entitlement import Entitlement
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

MONTHLY_PLAN = "monthly"
ONE_TIME_PLAN = "one_time"

ACTIVE = "active"
CANCELLED = "cancelled"
EXPIRED = "expired"

_MONTHLY_DURATION_DAYS = 30  # Fallback when Stripe period end is unavailable


async def grant_entitlement(
    db: AsyncSession,
    *,
    user_id: str,
    plan: str,
    stripe_session_id: str,
    stripe_customer_id: Optional[str] = None,
    stripe_subscription_id: Optional[str] = None,
    expires_at: Optional[datetime] = None,
) -> Entitlement:
    """Grant (or refresh) a Pro entitlement for a user.

    Idempotent per Stripe session: if an entitlement for the same
    ``stripe_session_id`` already exists, it is refreshed instead of duplicated.
    """
    if plan not in (MONTHLY_PLAN, ONE_TIME_PLAN):
        logger.warning("Refusing to grant entitlement with unknown plan=%r", plan)
        raise ValueError(f"Unsupported plan: {plan}")

    result = await db.execute(
        select(Entitlement).where(Entitlement.stripe_session_id == stripe_session_id)
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        # Refresh the existing record (e.g. webhook replay or re-verification).
        existing.user_id = user_id
        existing.plan = plan
        existing.status = ACTIVE
        existing.stripe_customer_id = stripe_customer_id or existing.stripe_customer_id
        existing.stripe_subscription_id = (
            stripe_subscription_id or existing.stripe_subscription_id
        )
        existing.expires_at = expires_at
        logger.info(
            "Refreshed existing entitlement session=%s user_id=%s plan=%s",
            stripe_session_id,
            user_id,
            plan,
        )
        await db.commit()
        await db.refresh(existing)
        return existing

    if expires_at is None and plan == MONTHLY_PLAN:
        expires_at = datetime.now(timezone.utc) + timedelta(days=_MONTHLY_DURATION_DAYS)

    entitlement = Entitlement(
        user_id=user_id,
        plan=plan,
        status=ACTIVE,
        stripe_session_id=stripe_session_id,
        stripe_customer_id=stripe_customer_id,
        stripe_subscription_id=stripe_subscription_id,
        expires_at=expires_at,
    )
    db.add(entitlement)
    await db.commit()
    await db.refresh(entitlement)

    logger.info(
        "Granted Pro entitlement user_id=%s plan=%s session=%s subscription=%s",
        user_id,
        plan,
        stripe_session_id,
        stripe_subscription_id,
    )
    return entitlement


async def has_active_entitlement(db: AsyncSession, user_id: str) -> bool:
    """Return True if the user holds at least one active Pro entitlement."""
    result = await db.execute(
        select(Entitlement).where(
            and_(
                Entitlement.user_id == user_id,
                Entitlement.status == ACTIVE,
            )
        )
    )
    records = result.scalars().all()
    now = datetime.now(timezone.utc)
    for record in records:
        if record.is_active(now):
            return True
    return False


async def get_active_entitlement(
    db: AsyncSession, user_id: str
) -> Optional[Entitlement]:
    """Return the most recently granted active entitlement, if any."""
    result = await db.execute(
        select(Entitlement)
        .where(
            and_(
                Entitlement.user_id == user_id,
                Entitlement.status == ACTIVE,
            )
        )
        .order_by(Entitlement.id.desc())
        .limit(1)
    )
    record = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if record is not None and record.is_active(now):
        return record
    return None


async def revoke_entitlement(
    db: AsyncSession,
    *,
    stripe_subscription_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> None:
    """Mark matching monthly entitlements as cancelled (idempotent)."""
    conditions = [Entitlement.status == ACTIVE]
    if stripe_subscription_id:
        conditions.append(Entitlement.stripe_subscription_id == stripe_subscription_id)
    if user_id:
        conditions.append(Entitlement.user_id == user_id)

    result = await db.execute(select(Entitlement).where(and_(*conditions)))
    records = result.scalars().all()
    if not records:
        logger.debug("No active entitlements to revoke (sub=%s user=%s)", stripe_subscription_id, user_id)
        return

    for record in records:
        record.status = CANCELLED
        logger.info(
            "Revoked entitlement id=%s user_id=%s plan=%s sub=%s",
            record.id,
            record.user_id,
            record.plan,
            record.stripe_subscription_id,
        )
    await db.commit()
