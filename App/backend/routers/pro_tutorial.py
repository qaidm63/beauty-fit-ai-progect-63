"""Pro tutorial router — personalized makeup tutorials for paid users."""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, status
from schemas.pro_tutorial import (
    ProTutorialRequest,
    ProTutorialResponse,
    StylizeRequest,
    StylizeResponse,
)
from services.pro_tutorial import generate_pro_tutorial, stylize_user_photo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/pro", tags=["pro-tutorial"])


@router.post("/tutorial", response_model=ProTutorialResponse)
async def post_pro_tutorial(
    req: ProTutorialRequest,
) -> ProTutorialResponse:
    """Generate a personalized Pro makeup tutorial for the given style + profile.

    NOTE (testing phase): Authentication and Pro entitlement checks have been
    temporarily removed so testers can view the complete report end-to-end.
    Re-enable `get_current_user` dependency before production release.
    """
    try:
        logger.info("Generating pro tutorial (testing mode): style=%s", req.style)
        return await generate_pro_tutorial(req)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Pro tutorial generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate pro tutorial.",
        )


@router.post("/stylize", response_model=StylizeResponse)
async def post_stylize(req: StylizeRequest) -> StylizeResponse:
    """Generate an AI-stylized makeup image from the user's photo.

    Accepts the user's photo (base64 data URI or URL) and returns a new image
    with the requested style + sub-style applied via img2img.
    """
    try:
        sub_style_key = req.sub_style or "overall"
        logger.info(
            "Stylize request: style=%s sub_style=%s",
            req.style,
            sub_style_key,
        )

        # 1. Execute stylize process
        raw_result: Any = await stylize_user_photo(
            style=req.style,
            sub_style=sub_style_key,
            image=req.image,
        )

        # 2. Extract a valid image reference cleanly from the stylize result.
        image_b64: Optional[str] = None

        def _looks_like_image(value: Optional[str]) -> bool:
            if not isinstance(value, str):
                return False
            cleaned = value.strip()
            if not cleaned:
                return False
            return cleaned.startswith("data:image/") or cleaned.startswith("http://") or cleaned.startswith("https://")

        if isinstance(raw_result, str):
            image_b64 = raw_result.strip()
        elif isinstance(raw_result, dict):
            for key in ("image", "url", "b64", "b64_json", "data"):
                candidate = raw_result.get(key)
                if _looks_like_image(candidate):
                    image_b64 = str(candidate).strip()
                    break

            if not image_b64 and "images" in raw_result:
                images_dict = raw_result["images"]
                if isinstance(images_dict, dict):
                    cand_nested = (
                        images_dict.get(sub_style_key)
                        or images_dict.get("overall")
                        or next(iter(images_dict.values()), None)
                    )
                    if _looks_like_image(cand_nested):
                        image_b64 = str(cand_nested).strip()

        # 3. If the payload is a plain string that is not an image URL/data URI,
        # reject it so the frontend never receives prompt text as an image.
        if image_b64 and not _looks_like_image(image_b64):
            image_b64 = None

        # 4. Format Base64 Data URI header safely only when actual content exists
        if image_b64:
            if image_b64.startswith("data:image/"):
                parts = image_b64.split(",", 1)
                if len(parts) < 2 or not parts[1].strip():
                    image_b64 = None
            elif image_b64.startswith("http://") or image_b64.startswith("https://"):
                pass
            else:
                image_b64 = f"data:image/jpeg;base64,{image_b64}"

        # 5. Fail explicitly if image generation produced empty output
        if not image_b64:
            logger.error("[Stylize Error] Empty or invalid image payload generated for style=%s", req.style)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Stylize engine returned an empty image payload.",
            )

        return StylizeResponse(
            style=req.style,
            sub_style=sub_style_key,
            image=image_b64,
        )

    except HTTPException:
        raise
    except ValueError as exc:
        logger.warning("Stylize bad request: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except RuntimeError as exc:
        msg = str(exc)
        logger.warning("Stylize unavailable: %s", msg)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=msg or "Stylize service is temporarily unavailable.",
        )
    except Exception as exc:
        logger.exception("Stylize failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate stylized image.",
        )
