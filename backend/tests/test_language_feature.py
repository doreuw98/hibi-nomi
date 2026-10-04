"""Language feature backend tests for HIBI NOMI.

Covers:
  - GET /api/profile defaults language to 'en'
  - PUT /api/profile {language:'ja'} persists and returns 200
  - PUT /api/profile {language:'fr'} returns 422 'Unsupported language'
  - email_service.RESET_COPY has en/id/ja (code-path check; no email send)
  - forgot-password route calls send_password_reset_email with profile language
    (verified via source read; no email sent to avoid rate limits)

The suite also cleans up: demo@hibinomi.app language is restored to 'en' at the end.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@hibinomi.app"
DEMO_PASSWORD = "water123"


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def demo_token(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, f"demo login failed: {r.status_code} {r.text}"
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def fresh_user(session):
    """A fresh TEST_ user is used for 422 and default-language assertions so we
    don't thrash demo profile state."""
    email = f"TEST_{uuid.uuid4().hex[:10]}@hibinomi.app"
    r = session.post(f"{API}/auth/register",
                     json={"email": email, "password": "water123", "name": "Lang User"})
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


class TestLanguageProfile:
    def test_default_language_is_en(self, session, fresh_user):
        r = session.get(f"{API}/profile", headers=_auth(fresh_user))
        assert r.status_code == 200
        assert r.json().get("language") == "en"

    def test_set_language_ja_persists(self, session, demo_token):
        put = session.put(f"{API}/profile", json={"language": "ja"}, headers=_auth(demo_token))
        assert put.status_code == 200, put.text
        assert put.json().get("language") == "ja"
        # Verify by GET (round-trip persistence)
        get = session.get(f"{API}/profile", headers=_auth(demo_token))
        assert get.status_code == 200
        assert get.json().get("language") == "ja"

    def test_set_language_id_persists(self, session, demo_token):
        put = session.put(f"{API}/profile", json={"language": "id"}, headers=_auth(demo_token))
        assert put.status_code == 200
        assert put.json().get("language") == "id"
        get = session.get(f"{API}/profile", headers=_auth(demo_token))
        assert get.json().get("language") == "id"

    def test_unsupported_language_returns_422(self, session, demo_token):
        put = session.put(f"{API}/profile", json={"language": "fr"}, headers=_auth(demo_token))
        assert put.status_code == 422
        # Pydantic/FastAPI style detail wrapper
        detail = put.json().get("detail")
        if isinstance(detail, str):
            assert "Unsupported language" in detail
        else:
            # list form: [{loc, msg, type}]
            msgs = " ".join(str(d) for d in (detail or []))
            assert "Unsupported" in msgs or "language" in msgs

    def test_other_unsupported_values_422(self, session, demo_token):
        for bad in ("EN", "", "de", "zh", "english"):
            put = session.put(f"{API}/profile", json={"language": bad}, headers=_auth(demo_token))
            assert put.status_code == 422, f"expected 422 for language={bad!r}, got {put.status_code}"

    def test_restore_demo_language_to_en(self, session, demo_token):
        """Teardown step — demo user must end on 'en' per request."""
        put = session.put(f"{API}/profile", json={"language": "en"}, headers=_auth(demo_token))
        assert put.status_code == 200
        assert put.json().get("language") == "en"
        get = session.get(f"{API}/profile", headers=_auth(demo_token))
        assert get.json().get("language") == "en"


class TestEmailResetCopy:
    """Static/source-level checks — no email is actually sent (rate-limited)."""

    def test_reset_copy_has_en_id_ja(self):
        # Ensure backend env is loaded for module-level env lookups
        from dotenv import load_dotenv  # type: ignore
        import pathlib as _p
        load_dotenv(_p.Path(__file__).resolve().parents[1] / ".env")
        from email_service import RESET_COPY  # type: ignore
        assert set(RESET_COPY.keys()) >= {"en", "id", "ja"}
        for lang in ("en", "id", "ja"):
            copy = RESET_COPY[lang]
            # Each locale must have the standard template keys
            for k in ("subject", "hi", "hi_anon", "body", "ignore", "footer"):
                assert k in copy and copy[k], f"{lang}:{k} missing"

    def test_forgot_password_uses_profile_language(self):
        """Reads server.py source to confirm the lang= argument is sourced from
        the user's profile language (code-path assertion). We deliberately do
        NOT POST to /auth/forgot-password here to avoid consuming the 3/15min
        rate-limit shared with the UI test flow."""
        import pathlib
        src = pathlib.Path(__file__).resolve().parents[1] / "server.py"
        text = src.read_text(encoding="utf-8")
        assert "send_password_reset_email(" in text
        # The forgot-password block loads profile then passes lang=profile.get("language")
        assert "lang=profile.get(\"language\")" in text or "lang=profile.get('language')" in text
