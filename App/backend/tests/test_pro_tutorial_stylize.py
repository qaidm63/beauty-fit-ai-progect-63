import base64
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.pro_tutorial import render_stylized_preview


def test_render_stylized_preview_returns_valid_data_uri() -> None:
    source = Image.new("RGB", (320, 320), color=(240, 220, 210))

    data_uri = render_stylized_preview(source, style="sweet", sub_style="Kawaii")

    assert data_uri.startswith("data:image/jpeg;base64,")
    payload = data_uri.split(",", 1)[1]
    image_bytes = base64.b64decode(payload)
    assert image_bytes.startswith(b"\xff\xd8\xff")
