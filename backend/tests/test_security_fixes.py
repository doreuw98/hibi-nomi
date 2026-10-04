"""Security audit regression — HIBI NOMI backend.

Covers:
  - Forgot-password no longer leaks reset_token (CRITICAL fix 1)
  - Reset-password revokes existing sessions (fix 2)
  - Case-insensitive single-use reset code (fix 3)
  - Rate limiting on forgot/login (fix 4)
  - CSV formula injection neutralisation (fix 5)
  - Register duplicate returns 409 with generic message (fix 6)
  - Security headers on responses (fix 7)
"""
import csv
import io
import os
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

RESET_INBOX = "delivered@resend.dev"
RESET_PWD = "water123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


def _rand_email():
    return f"TEST_{uuid.uuid4().hex[:10]}@hibinomi.app"


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --------- 1 & 3: forgot-password response + reset flow via Mongo ----------
class TestForgotPasswordSecurity:
    def test_forgot_does_not_return_token(self, session):
        r = session.post(f"{API}/auth/forgot-password", json={"email": RESET_INBOX})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "reset_token" not in body, f"CRITICAL leak: {body}"
        assert set(body.keys()) <= {"ok", "message"}, f"unexpected keys: {body.keys()}"

    def test_unknown_email_same_generic_response(self, session):
        r = session.post(f"{API}/auth/forgot-password", json={"email": "nobody@example.com"})
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        assert "reset_token" not in body

    def test_full_reset_cycle_revokes_sessions_single_use_case_insensitive(self, session, mongo):
        # Login first to obtain an old session.
        login_old = session.post(f"{API}/auth/login", json={"email": RESET_INBOX, "password": RESET_PWD})
        assert login_old.status_code == 200, login_old.text
        old_token = login_old.json()["session_token"]
        me_before = session.get(f"{API}/auth/me", headers=_auth(old_token))
        assert me_before.status_code == 200

        # Trigger forgot and read code from mongo
        r = session.post(f"{API}/auth/forgot-password", json={"email": RESET_INBOX})
        assert r.status_code == 200
        user = mongo.users.find_one({"email": RESET_INBOX})
        code = user.get("reset_token")
        assert code and len(code) == 8, f"code shape wrong: {code!r}"
        # 8-char uppercase alphanumeric, excludes I/O/0/1
        allowed = set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
        assert set(code).issubset(allowed), f"bad alphabet: {code}"

        new_pwd = "newpass123"
        # use lowercase to verify case-insensitive matching
        rr = session.post(
            f"{API}/auth/reset-password",
            json={"reset_token": code.lower(), "new_password": new_pwd},
        )
        assert rr.status_code == 200, rr.text

        # Old session must be revoked
        me_after = session.get(f"{API}/auth/me", headers=_auth(old_token))
        assert me_after.status_code == 401, f"old session not revoked: {me_after.status_code}"

        # Old password must fail; new password works
        bad = session.post(f"{API}/auth/login", json={"email": RESET_INBOX, "password": RESET_PWD})
        assert bad.status_code == 401
        good = session.post(f"{API}/auth/login", json={"email": RESET_INBOX, "password": new_pwd})
        assert good.status_code == 200

        # Single-use: second use of same code must fail with 400
        reused = session.post(
            f"{API}/auth/reset-password",
            json={"reset_token": code, "new_password": "another123"},
        )
        assert reused.status_code == 400, f"code re-use allowed: {reused.status_code}"

        # Restore password back to water123 via another cycle
        r2 = session.post(f"{API}/auth/forgot-password", json={"email": RESET_INBOX})
        assert r2.status_code == 200
        user2 = mongo.users.find_one({"email": RESET_INBOX})
        code2 = user2.get("reset_token")
        assert code2
        rr2 = session.post(
            f"{API}/auth/reset-password",
            json={"reset_token": code2, "new_password": RESET_PWD},
        )
        assert rr2.status_code == 200
        # Verify restored
        verify = session.post(f"{API}/auth/login", json={"email": RESET_INBOX, "password": RESET_PWD})
        assert verify.status_code == 200, "failed to restore water123 for delivered@resend.dev"

    def test_invalid_reset_code_400(self, session):
        r = session.post(
            f"{API}/auth/reset-password",
            json={"reset_token": "ZZZZZZZZ", "new_password": "whatever123"},
        )
        assert r.status_code == 400

    def test_undeliverable_email_still_returns_generic_200(self, session):
        """Follow-up fix: proxy may 422 'undeliverable_recipient' (e.g. demo@hibinomi.app).
        Client must still see 200 {ok, message} identical to unknown-email response — no 502,
        no account-enumeration side channel."""
        r_known = session.post(f"{API}/auth/forgot-password", json={"email": "demo@hibinomi.app"})
        r_unknown = session.post(f"{API}/auth/forgot-password", json={"email": "nobody@example.com"})
        assert r_known.status_code == 200, r_known.text
        assert r_unknown.status_code == 200, r_unknown.text
        bk, bu = r_known.json(), r_unknown.json()
        assert bk.get("ok") is True and bu.get("ok") is True
        assert bk == bu, f"shape differs → enumeration risk: known={bk} unknown={bu}"
        assert "reset_token" not in bk


# --------- 4: rate limiting ----------
class TestRateLimiting:
    def test_forgot_password_4th_call_rate_limited(self, session, mongo):
        # Use a throwaway real-user to avoid impacting delivered@resend.dev's quota.
        email = _rand_email()
        reg = session.post(f"{API}/auth/register", json={"email": email, "password": "water123", "name": "RL"})
        assert reg.status_code == 200
        # Patch the email to delivered@resend.dev-like? No — only trigger forgot for THIS user, which
        # exists in DB → it will send a real email. Instead, point to a fake unknown email that still
        # exercises the limiter (limiter runs BEFORE user lookup).
        fake = f"nobody_{uuid.uuid4().hex[:8]}@example.com"
        statuses = []
        for _ in range(4):
            r = session.post(f"{API}/auth/forgot-password", json={"email": fake})
            statuses.append(r.status_code)
        assert statuses[:3] == [200, 200, 200], statuses
        assert statuses[3] == 429, f"expected 429 on 4th, got {statuses}"
        # cleanup
        mongo.users.delete_one({"email": email})

    def test_login_11th_failure_rate_limited(self, session):
        email = _rand_email()
        reg = session.post(f"{API}/auth/register", json={"email": email, "password": "water123", "name": "RL2"})
        assert reg.status_code == 200
        statuses = []
        for _ in range(11):
            r = session.post(f"{API}/auth/login", json={"email": email, "password": "wrong-pass"})
            statuses.append(r.status_code)
        assert statuses[:10] == [401] * 10, statuses
        assert statuses[10] == 429, f"expected 429 on 11th, got {statuses}"


# --------- 6: register duplicate ----------
class TestRegisterDuplicate:
    def test_duplicate_email_409_generic_message(self, session):
        email = _rand_email()
        r1 = session.post(f"{API}/auth/register", json={"email": email, "password": "water123", "name": "Dup"})
        assert r1.status_code == 200
        r2 = session.post(f"{API}/auth/register", json={"email": email, "password": "water123", "name": "Dup2"})
        assert r2.status_code == 409
        body = r2.json()
        detail = (body.get("detail") or "").lower()
        assert "already exists" not in detail, f"message leaks existence: {detail!r}"


# --------- 5: CSV formula injection neutralisation ----------
class TestCSVInjection:
    def test_formula_cell_is_prefixed_with_apostrophe(self, session):
        email = _rand_email()
        reg = session.post(f"{API}/auth/register", json={"email": email, "password": "water123", "name": "CSV"})
        assert reg.status_code == 200
        token = reg.json()["session_token"]
        from datetime import date as _date
        today = _date.today().isoformat()
        payload = {"amount_ml": 123, "local_date": today, "note": '=HYPERLINK("x")'}
        c = session.post(f"{API}/intakes", json=payload, headers=_auth(token))
        assert c.status_code == 200, c.text
        iid = c.json()["id"]
        try:
            exp = session.get(f"{API}/export/csv", headers=_auth(token))
            assert exp.status_code == 200
            # Parse CSV, find the row for our note
            reader = csv.reader(io.StringIO(exp.text))
            rows = list(reader)
            # locate our row
            match = [r for r in rows[1:] if r and r[-1].endswith('HYPERLINK("x")')]
            assert match, f"no injected row found; rows={rows}"
            note_cell = match[0][-1]
            assert note_cell.startswith("'="), f"cell not neutralised: {note_cell!r}"
        finally:
            session.delete(f"{API}/intakes/{iid}", headers=_auth(token))


# --------- 7: security headers ----------
class TestSecurityHeaders:
    def test_headers_present_on_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.headers.get("x-content-type-options", "").lower() == "nosniff"
        assert "strict-transport-security" in {k.lower() for k in r.headers.keys()}
        assert r.headers.get("x-frame-options", "").upper() == "DENY"
        assert "no-referrer" in (r.headers.get("referrer-policy") or "").lower()
        assert "no-store" in (r.headers.get("cache-control") or "").lower()
