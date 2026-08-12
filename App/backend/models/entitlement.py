from datetime import datetime, timezone
from typing import Optional

from models.base import BaseModel
from sqlalchemy import Column, DateTime, Integer, String, func


def _ensure_aware(value: datetime) -> datetime:
    """Attach UTC to naive datetimes (e.g. values read back from SQLite)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class Entitlement(BaseModel):
    """Server-side record of a Pro entitlement granted after payment.

    This is the authoritative source of truth for Pro access (as opposed to the
    old client-side localStorage flag which could be trivially forged).
    """

    __tablename__ = "entitlements"

    user_id = Column(String(255), nullable=False, index=True)
    plan = Column(String(50), nullable=False, default="one_time")  # one_time | monthly
    status = Column(String(50), nullable=False, default="active")  # active | cancelled | expired
    stripe_session_id = Column(String(255), unique=True, index=True, nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), index=True, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # null => one-time (lifetime)

    def is_active(self, now: Optional[datetime] = None) -> bool:
        """One-time entitlements never expire; monthly ones expire at `expires_at`."""
        if self.status != "active":
            return False
        if self.expires_at is None:
            return True
        expires_at = _ensure_aware(self.expires_at)
        reference = _ensure_aware(now) if now is not None else datetime.now(timezone.utc)
        return reference < expires_at
