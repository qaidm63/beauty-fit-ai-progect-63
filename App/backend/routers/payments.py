"""Payment router for Stripe checkout sessions and Pro entitlement granting."""

import logging
from datetime import datetime, timezone
from typing import Optional

from core.config import settings
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.entitlement import grant_entitlement, get_active_entitlement, revoke_entitlement
from services.payment import CheckoutError, PaymentService
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])

payment_service = PaymentService()

ACCESS_COOKIE_NAME = "bf_access_token"


class CreatePaymentSessionRequest(BaseModel):
    """Request to create a Stripe checkout session."""
    plan: str = Field(..., description="Plan type: 'one_time' or 'monthly'")
    style_id: Optional[str] = Field(None, description="Style ID for the report")
    success_url: Optional[str] = Field(None, description="URL to redirect after success")
    cancel_url: Optional[str] = Field(None, description="URL to redirect on cancel")


class CreatePaymentSessionResponse(BaseModel):
    """Response with checkout URL."""
    url: Optional[str] = None
    session_id: str = ""


class VerifyPaymentRequest(BaseModel):
    """Request to verify a payment session."""
    session_id: str = Field(..., description="Stripe checkout session ID")


class VerifyPaymentResponse(BaseModel):
    """Response with payment verification result."""
    status: str = ""
    payment_status: str = ""
    plan: str = ""
    style_id: str = ""
    amount_total: int = 0
    currency: str = ""
    entitlement_granted: bool = False


class EntitlementResponse(BaseModel):
    """Current user's Pro entitlement status."""
    has_pro: bool = False
    plan: str = ""
    expires_at: Optional[datetime] = None


def _derive_origin(request: Request) -> str:
    """Determine the frontend origin for redirect URLs."""
    origin = str(request.headers.get("origin", ""))
    if not origin:
        referer = str(request.headers.get("referer", ""))
        if referer:
            from urllib.parse import urlparse

            parsed = urlparse(referer)
            origin = f"{parsed.scheme}://{parsed.netloc}"
    if not origin:
        origin = getattr(settings, "frontend_url", None) or "http://localhost:5173"
    return origin


@router.post("/create_payment_session", response_model=CreatePaymentSessionResponse)
async def create_payment_session(
    request: Request,
    body: CreatePaymentSessionRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """Create a Stripe checkout session for one-time or subscription payment.

    Requires an authenticated user: the granted entitlement is bound to the
    account that made the purchase (metadata carries the user id to the webhook).
    """
    try:
        origin = _derive_origin(request)
        success_url = body.success_url or f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = body.cancel_url or f"{origin}/results"

        metadata = {
            "plan": body.plan,
            "style_id": body.style_id or "",
            "user_id": current_user.id,
            "email": current_user.email,
        }

        if body.plan == "monthly":
            # Subscription mode - $7.99/month
            import stripe

            await payment_service._auto_reload_stripe_config()

            session = await stripe.checkout.Session.create_async(
                line_items=[
                    {
                        "price_data": {
                            "currency": "usd",
                            "product_data": {
                                "name": "BeautyFit Pro Monthly",
                                "description": "All top 3 style reports + unlimited regenerations",
                            },
                            "unit_amount": 799,  # $7.99 in cents
                            "recurring": {
                                "interval": "month",
                            },
                        },
                        "quantity": 1,
                    }
                ],
                mode="subscription",
                success_url=success_url,
                cancel_url=cancel_url,
                customer_email=current_user.email,
                metadata=metadata,
            )

            return CreatePaymentSessionResponse(
                url=session.url,
                session_id=session.id,
            )
        else:
            # One-time payment - $1.80
            from services.payment import CheckoutSessionRequest as StripeRequest

            stripe_request = StripeRequest(
                amount=1.80,
                currency="usd",
                mode="payment",
                ui_mode="hosted",
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata,
            )

            result = await payment_service.create_checkout_session(stripe_request)

            return CreatePaymentSessionResponse(
                url=result.url,
                session_id=result.session_id,
            )

    except CheckoutError as e:
        logger.error("Checkout error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Payment session creation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to create payment session: {str(e)}")


@router.post("/verify_payment", response_model=VerifyPaymentResponse)
async def verify_payment(
    body: VerifyPaymentRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify a Stripe checkout session and grant the Pro entitlement.

    The webhook is the authoritative source, but this endpoint provides a
    synchronous fallback so the success page can unlock access immediately.
    """
    try:
        result = await payment_service.get_checkout_status(body.session_id)

        payment_ok = result.payment_status == "paid" or result.status == "complete"
        entitlement_granted = False

        if payment_ok:
            plan = result.metadata.get("plan", "one_time")
            granted = await grant_entitlement(
                db,
                user_id=current_user.id,
                plan=plan,
                stripe_session_id=body.session_id,
                stripe_customer_id=result.metadata.get("customer_id"),
            )
            entitlement_granted = granted is not None

        return VerifyPaymentResponse(
            status=result.status,
            payment_status=result.payment_status,
            plan=result.metadata.get("plan", ""),
            style_id=result.metadata.get("style_id", ""),
            amount_total=result.amount_total,
            currency=result.currency,
            entitlement_granted=entitlement_granted,
        )

    except CheckoutError as e:
        logger.error("Payment verification error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Payment verification failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to verify payment: {str(e)}")


@router.get("/entitlement", response_model=EntitlementResponse)
async def get_my_entitlement(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's Pro entitlement status."""
    entitlement = await get_active_entitlement(db, current_user.id)
    if entitlement is None:
        return EntitlementResponse(has_pro=False)
    return EntitlementResponse(
        has_pro=True,
        plan=entitlement.plan,
        expires_at=entitlement.expires_at,
    )


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events.

    Authoritative source for granting (checkout.session.completed,
    invoice.paid) and revoking (customer.subscription.deleted) entitlements.
    """
    import stripe

    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    webhook_secret = getattr(settings, "stripe_webhook_secret", None) or ""

    if not webhook_secret:
        logger.error("STRIPE_WEBHOOK_SECRET is not configured; rejecting webhook")
        raise HTTPException(status_code=500, detail="Webhook secret is not configured")

    try:
        await payment_service._auto_reload_stripe_config()
        event = stripe.Webhook.construct_event(
            payload,
            signature,
            webhook_secret,
        )
        # In stripe>=15, construct_event returns a StripeObject (not a plain
        # dict), so normalize it with to_dict() before accessing .get() keys.
        if hasattr(event, "to_dict"):
            event = event.to_dict()
    except ValueError as exc:
        logger.error("Webhook payload parse failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as exc:
        logger.error("Webhook signature verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event.get("type", "")
    data = event.get("data", {})
    event_object = data.get("object", {}) if isinstance(data, dict) else {}

    try:
        if event_type == "checkout.session.completed":
            await _handle_checkout_completed(db, event_object)
        elif event_type == "invoice.paid":
            await _handle_invoice_paid(db, event_object)
        elif event_type in ("customer.subscription.deleted",):
            await _handle_subscription_deleted(db, event_object)
        elif event_type == "customer.subscription.updated":
            await _handle_subscription_updated(db, event_object)
        else:
            logger.debug("Ignoring unhandled webhook event type=%s", event_type)
    except Exception as exc:
        logger.exception("Webhook handler failed for type=%s: %s", event_type, exc)
        # Return 500 so Stripe retries; the event is idempotent on our side.
        raise HTTPException(status_code=500, detail="Webhook handler error")

    return {"received": True}


async def _handle_checkout_completed(db: AsyncSession, session: dict) -> None:
    import stripe

    metadata = session.get("metadata") or {}
    plan = metadata.get("plan", "one_time")
    user_id = metadata.get("user_id", "")
    session_id = session.get("id", "")

    if not user_id or not session_id:
        logger.warning("checkout.session.completed missing user_id or session id; skipping")
        return

    expires_at = None
    subscription_id = session.get("subscription")

    if plan == "monthly" and subscription_id:
        try:
            sub = await stripe.Subscription.retrieve_async(subscription_id)
            period_end = getattr(sub, "current_period_end", None)
            if period_end:
                expires_at = datetime.fromtimestamp(period_end, tz=timezone.utc)
        except Exception as exc:
            logger.warning("Failed to fetch subscription %s for period end: %s", subscription_id, exc)

    await grant_entitlement(
        db,
        user_id=user_id,
        plan=plan,
        stripe_session_id=session_id,
        stripe_customer_id=session.get("customer"),
        stripe_subscription_id=subscription_id,
        expires_at=expires_at,
    )


async def _handle_invoice_paid(db: AsyncSession, invoice: dict) -> None:
    import stripe

    from models.entitlement import Entitlement
    from sqlalchemy import select

    subscription_id = invoice.get("subscription")
    if not subscription_id:
        return

    # Locate the entitlement by subscription id, falling back to the customer.
    result = await db.execute(
        select(Entitlement).where(
            Entitlement.stripe_subscription_id == subscription_id,
            Entitlement.status == "active",
        )
    )
    entitlement = result.scalar_one_or_none()

    if entitlement is None:
        customer_id = invoice.get("customer")
        if customer_id:
            customer_result = await db.execute(
                select(Entitlement)
                .where(
                    Entitlement.stripe_customer_id == customer_id,
                    Entitlement.status == "active",
                )
                .order_by(Entitlement.id.desc())
                .limit(1)
            )
            entitlement = customer_result.scalar_one_or_none()

    if entitlement is None:
        # The checkout.session.completed handler (or verify_payment) will grant
        # the entitlement; we only extend renewals for known subscriptions.
        logger.info("invoice.paid for unknown subscription %s; skipping", subscription_id)
        return

    try:
        sub = await stripe.Subscription.retrieve_async(subscription_id)
        period_end = getattr(sub, "current_period_end", None)
        if period_end:
            entitlement.expires_at = datetime.fromtimestamp(period_end, tz=timezone.utc)
            entitlement.status = "active"
            if entitlement.stripe_subscription_id != subscription_id:
                entitlement.stripe_subscription_id = subscription_id
            await db.commit()
            logger.info(
                "Extended entitlement id=%s user_id=%s to %s",
                entitlement.id,
                entitlement.user_id,
                entitlement.expires_at,
            )
    except Exception as exc:
        logger.warning("Failed to extend subscription %s: %s", subscription_id, exc)


async def _handle_subscription_deleted(db: AsyncSession, subscription: dict) -> None:
    subscription_id = subscription.get("id")
    await revoke_entitlement(db, stripe_subscription_id=subscription_id)


async def _handle_subscription_updated(db: AsyncSession, subscription: dict) -> None:
    status_val = subscription.get("status")
    subscription_id = subscription.get("id")
    if status_val not in ("active", "trialing"):
        await revoke_entitlement(db, stripe_subscription_id=subscription_id)
