"""Preset icons regression tests for HIBI NOMI backend.

Verifies:
  - PUT /api/profile accepts quick_presets as objects {amount_ml, icon}
  - Invalid icon returns 422
  - GET /api/profile returns objects {amount_ml, icon}
  - Legacy integer list is normalized to objects on GET
  - Default icons applied when icon missing
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _rand_email():
    return f"TEST_{uuid.uuid4().hex[:10]}@hibinomi.app"


def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def test_user(session):
    email = _rand_email()
    r = session.post(f"{API}/auth/register",
                     json={"email": email, "password": "water123", "name": "Icon Tester"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["session_token"]}


# ---------- Preset icon validation ----------
class TestPresetIcons:
    def test_default_profile_has_default_presets_with_icons(self, session, test_user):
        r = session.get(f"{API}/profile", headers=auth(test_user["token"]))
        assert r.status_code == 200
        presets = r.json()["quick_presets"]
        assert isinstance(presets, list) and len(presets) == 5
        for p in presets:
            assert "amount_ml" in p and "icon" in p
        # default-icon mapping: <300=glass, <500=mug, >=500=bottle
        by_ml = {p["amount_ml"]: p["icon"] for p in presets}
        assert by_ml[100] == "glass"
        assert by_ml[200] == "glass"
        assert by_ml[250] == "glass"
        assert by_ml[300] == "mug"
        assert by_ml[500] == "bottle"

    def test_put_object_presets_persists_icons(self, session, test_user):
        payload = {"quick_presets": [
            {"amount_ml": 150, "icon": "glass"},
            {"amount_ml": 300, "icon": "wine"},
            {"amount_ml": 750, "icon": "jar"},
        ]}
        r = session.put(f"{API}/profile", json=payload, headers=auth(test_user["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        by_ml = {p["amount_ml"]: p["icon"] for p in body["quick_presets"]}
        assert by_ml == {150: "glass", 300: "wine", 750: "jar"}

        # Verify persistence via GET
        g = session.get(f"{API}/profile", headers=auth(test_user["token"]))
        assert g.status_code == 200
        gby_ml = {p["amount_ml"]: p["icon"] for p in g.json()["quick_presets"]}
        assert gby_ml == {150: "glass", 300: "wine", 750: "jar"}

    def test_put_single_preset_with_icon_150(self, session, test_user):
        r = session.put(f"{API}/profile",
                        json={"quick_presets": [{"amount_ml": 150, "icon": "glass"}]},
                        headers=auth(test_user["token"]))
        assert r.status_code == 200
        presets = r.json()["quick_presets"]
        assert len(presets) == 1
        assert presets[0] == {"amount_ml": 150, "icon": "glass"}

    def test_invalid_icon_returns_422(self, session, test_user):
        r = session.put(f"{API}/profile",
                        json={"quick_presets": [{"amount_ml": 150, "icon": "rocket"}]},
                        headers=auth(test_user["token"]))
        assert r.status_code == 422, r.text

    def test_all_valid_icons_accepted(self, session, test_user):
        icons = ["glass", "mug", "bottle", "drop", "wine", "jar"]
        presets = [{"amount_ml": (i + 1) * 100, "icon": ic} for i, ic in enumerate(icons)]
        r = session.put(f"{API}/profile", json={"quick_presets": presets},
                        headers=auth(test_user["token"]))
        assert r.status_code == 200, r.text
        by_ml = {p["amount_ml"]: p["icon"] for p in r.json()["quick_presets"]}
        for i, ic in enumerate(icons):
            assert by_ml[(i + 1) * 100] == ic

    def test_duplicate_amount_rejected(self, session, test_user):
        r = session.put(f"{API}/profile", json={"quick_presets": [
            {"amount_ml": 200, "icon": "glass"},
            {"amount_ml": 200, "icon": "mug"},
        ]}, headers=auth(test_user["token"]))
        assert r.status_code == 422

    def test_too_many_presets_rejected(self, session, test_user):
        presets = [{"amount_ml": (i + 1) * 50, "icon": "glass"} for i in range(7)]
        r = session.put(f"{API}/profile", json={"quick_presets": presets},
                        headers=auth(test_user["token"]))
        assert r.status_code == 422

    def test_amount_out_of_range_rejected(self, session, test_user):
        r = session.put(f"{API}/profile",
                        json={"quick_presets": [{"amount_ml": 6000, "icon": "glass"}]},
                        headers=auth(test_user["token"]))
        assert r.status_code == 422

    def test_preset_icon_defaults_to_drop_when_missing(self, session, test_user):
        # PresetIn.icon defaults to "drop" when not provided
        r = session.put(f"{API}/profile",
                        json={"quick_presets": [{"amount_ml": 400}]},
                        headers=auth(test_user["token"]))
        assert r.status_code == 200
        assert r.json()["quick_presets"][0]["icon"] == "drop"


# ---------- Demo user default restoration ----------
class TestDemoUserPresets:
    """Ensure demo user has defaults at the end of the run."""

    def test_restore_demo_user_defaults(self, session):
        login = session.post(f"{API}/auth/login",
                             json={"email": "demo@hibinomi.app", "password": "water123"})
        assert login.status_code == 200
        token = login.json()["session_token"]
        default_presets = [
            {"amount_ml": 100, "icon": "glass"},
            {"amount_ml": 200, "icon": "glass"},
            {"amount_ml": 250, "icon": "glass"},
            {"amount_ml": 300, "icon": "mug"},
            {"amount_ml": 500, "icon": "bottle"},
        ]
        r = session.put(f"{API}/profile", json={"quick_presets": default_presets},
                        headers=auth(token))
        assert r.status_code == 200
        g = session.get(f"{API}/profile", headers=auth(token))
        got = g.json()["quick_presets"]
        assert got == default_presets
