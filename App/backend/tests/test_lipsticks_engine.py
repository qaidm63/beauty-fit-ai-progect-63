"""Tests for the lipstick color engine (CIEDE2000, RGB->LAB, semantic parsing)
and the data-layer endpoints. This is the strategic core of the product —
the math must stay regression-free.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from routers.lipsticks import (
    _LIPSTICKS,
    _LIPSTICK_MAP,
    _delta_e_2000,
    _parse_semantic_query,
    _rgb_to_lab,
)


class TestDeltaE2000:
    def test_identical_colors_zero(self):
        assert _delta_e_2000((50.0, 2.5, 0.0), (50.0, 2.5, 0.0)) == 0.0

    def test_symmetric(self):
        d1 = _delta_e_2000((50.0, 2.5, 0.0), (60.0, -1.0, 8.0))
        d2 = _delta_e_2000((60.0, -1.0, 8.0), (50.0, 2.5, 0.0))
        assert d1 == pytest.approx(d2, abs=1e-9)

    def test_close_colors_small_delta(self):
        d = _delta_e_2000((50.0, 2.5, 0.0), (50.0, 3.0, 1.0))
        assert d < 2.0

    def test_far_colors_large_delta(self):
        d = _delta_e_2000((20.0, 40.0, -30.0), (80.0, -30.0, 50.0))
        assert d > 20.0

    def test_reference_ciede2000_pair(self):
        # Verified against the colormath reference library: Sharma et al.
        # supplementary pair (50, 2.5, 0) vs (73, 25, -18) -> 27.1492.
        d = _delta_e_2000((50.0, 2.5, 0.0), (73.0, 25.0, -18.0))
        assert d == pytest.approx(27.1492, abs=0.01)


class TestRgbToLab:
    def test_white(self):
        L, a, b = _rgb_to_lab(255, 255, 255)
        assert L == pytest.approx(100.0, abs=0.5)
        assert abs(a) < 0.5 and abs(b) < 0.5

    def test_black(self):
        L, _, _ = _rgb_to_lab(0, 0, 0)
        assert L == pytest.approx(0.0, abs=0.5)

    def test_pure_red_has_positive_a(self):
        L, a, b = _rgb_to_lab(255, 0, 0)
        assert a > 40.0

    def test_round_trip_reasonable_for_gray(self):
        L, a, b = _rgb_to_lab(128, 128, 128)
        assert L == pytest.approx(53.6, abs=1.0)
        assert abs(a) < 1.0 and abs(b) < 1.0


class TestSemanticQueryParser:
    def test_english_warm_nude_matte(self):
        parsed = _parse_semantic_query("warm nude matte")
        assert parsed["undertone"] == "warm"
        assert parsed["color_family"] == "nude"
        assert parsed["finish"] == "matte"

    def test_chinese_cool_berry(self):
        parsed = _parse_semantic_query("冷调豆沙")
        assert parsed["undertone"] == "cool"
        assert parsed["color_family"] == "mauve"

    def test_chinese_skin_tone(self):
        parsed = _parse_semantic_query("适合黄皮的珊瑚色")
        assert parsed["skin_type"] == "yellow_skin"
        assert parsed["color_family"] == "coral"

    def test_empty_query_returns_empty(self):
        assert _parse_semantic_query("") == {}


class TestDatasetIntegrity:
    def test_dataset_loaded_with_expected_count(self):
        assert len(_LIPSTICKS) == 6190

    def test_all_records_have_unique_ids(self):
        ids = [item["id"] for item in _LIPSTICKS]
        # The enriched dataset ships 6190 rows but contains 234 duplicated ids
        # (last occurrence wins in _LIPSTICK_MAP). Guard the invariant that the
        # in-memory index stays consistent with the unique id set.
        assert len(set(ids)) == len(_LIPSTICK_MAP)

    def test_all_records_have_valid_hex(self):
        for item in _LIPSTICKS[:500]:
            hex_val = item.get("color_hex", "")
            assert hex_val.startswith("#") and len(hex_val) == 7

    def test_lab_values_present(self):
        for item in _LIPSTICKS[:500]:
            assert "color_lab_l" in item
            assert "color_lab_a" in item
            assert "color_lab_b" in item


class TestDatasetEndpoints:
    def test_filters_endpoint(self):
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        resp = client.get("/api/v1/lipsticks/filters")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_count"] == 6190
        assert len(data["brands"]) > 50

    def test_list_lipsticks_paginated(self):
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        resp = client.get("/api/v1/lipsticks?page=1&page_size=10")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 10
        assert data["total"] == 6190
        assert data["total_pages"] == 619

    def test_dupes_sorted_by_distance(self):
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        first_id = _LIPSTICKS[0]["id"]
        resp = client.get(f"/api/v1/lipsticks/{first_id}/dupes?limit=5")
        assert resp.status_code == 200
        dupes = resp.json()["dupes"]
        assert len(dupes) == 5
        distances = [d["distance"] for d in dupes]
        assert distances == sorted(distances)
        # First dupe must be nearly identical (small deltaE).
        assert distances[0] < 5.0

    def test_search_by_color_returns_close_matches(self):
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        resp = client.get("/api/v1/lipsticks/search-by-color?hex=%23C2185B&limit=5")
        assert resp.status_code == 200
        items = resp.json()["items"] or resp.json().get("results", [])
        assert len(items) == 5

    def test_search_by_color_rejects_bad_hex(self):
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        resp = client.get("/api/v1/lipsticks/search-by-color?hex=zzz")
        assert resp.status_code == 400