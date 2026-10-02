"""HIBI NOMI backend regression tests.

Covers:
  - Auth: register/login/logout/forgot/reset/me
  - Profile + target calc
  - Intakes CRUD + /day
  - Weekly + Monthly reports
  - Reminders GET/PUT
  - CSV export
  - Data isolation between users
"""
import os
import uuid
import requests
import pytest
from datetime import date, timedelta

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _rand_email():
    return f"TEST_{uuid.uuid4().hex[:10]}@hibinomi.app"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_a(session):
    email = _rand_email()
    r = session.post(f"{API}/auth/register", json={"email": email, "password": "water123", "name": "User A"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "password": "water123", "token": data["session_token"], "user": data["user"]}


@pytest.fixture(scope="module")
def user_b(session):
    email = _rand_email()
    r = session.post(f"{API}/auth/register", json={"email": email, "password": "water123", "name": "User B"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "password": "water123", "token": data["session_token"], "user": data["user"]}


def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("app") == "HIBI NOMI"

    def test_register_duplicate_409(self, session, user_a):
        r = session.post(f"{API}/auth/register", json={"email": user_a["email"], "password": "water123", "name": "Dup"})
        assert r.status_code == 409

    def test_login_success(self, session, user_a):
        r = session.post(f"{API}/auth/login", json={"email": user_a["email"], "password": user_a["password"]})
        assert r.status_code == 200
        body = r.json()
        assert "session_token" in body and body["user"]["email"].lower() == user_a["email"].lower()

    def test_login_wrong_password_401(self, session, user_a):
        r = session.post(f"{API}/auth/login", json={"email": user_a["email"], "password": "wrong-pass"})
        assert r.status_code == 401

    def test_me_with_token(self, session, user_a):
        r = session.get(f"{API}/auth/me", headers=auth(user_a["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["id"] == user_a["user"]["id"]
        assert "profile" in body

    def test_me_without_token_401(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_forgot_then_reset_password(self, session):
        # register a new user to safely reset
        email = _rand_email()
        reg = session.post(f"{API}/auth/register", json={"email": email, "password": "water123", "name": "Reset U"})
        assert reg.status_code == 200
        r1 = session.post(f"{API}/auth/forgot-password", json={"email": email})
        assert r1.status_code == 200
        token = r1.json().get("reset_token")
        assert token
        r2 = session.post(f"{API}/auth/reset-password", json={"reset_token": token, "new_password": "newpass123"})
        assert r2.status_code == 200
        # old password should now fail
        bad = session.post(f"{API}/auth/login", json={"email": email, "password": "water123"})
        assert bad.status_code == 401
        good = session.post(f"{API}/auth/login", json={"email": email, "password": "newpass123"})
        assert good.status_code == 200

    def test_logout_invalidates_token(self, session):
        email = _rand_email()
        reg = session.post(f"{API}/auth/register", json={"email": email, "password": "water123", "name": "Logout"})
        tok = reg.json()["session_token"]
        out = session.post(f"{API}/auth/logout", headers=auth(tok))
        assert out.status_code == 200
        me = session.get(f"{API}/auth/me", headers=auth(tok))
        assert me.status_code == 401


# ---------- Profile ----------
class TestProfile:
    def test_calc_target(self, session, user_a):
        r = session.post(f"{API}/profile/calculate-target",
                         json={"weight": 70, "activity_level": "moderate"},
                         headers=auth(user_a["token"]))
        assert r.status_code == 200
        # 70*35 + 500 = 2950 -> round to 2950
        assert r.json()["calculated_target"] == 2950

    def test_update_profile_auto_recomputes(self, session, user_a):
        r = session.put(f"{API}/profile", json={
            "weight": 80, "activity_level": "active", "target_mode": "auto",
            "wake_time": "06:30", "sleep_time": "22:30"
        }, headers=auth(user_a["token"]))
        assert r.status_code == 200
        body = r.json()
        # 80*35 + 750 = 3550
        assert body["daily_target"] == 3550
        assert body["wake_time"] == "06:30"
        assert body["sleep_time"] == "22:30"

    def test_update_profile_custom_target(self, session, user_a):
        r = session.put(f"{API}/profile", json={"target_mode": "custom", "daily_target": 2500},
                        headers=auth(user_a["token"]))
        assert r.status_code == 200
        assert r.json()["daily_target"] == 2500
        g = session.get(f"{API}/profile", headers=auth(user_a["token"]))
        assert g.json()["daily_target"] == 2500

    def test_invalid_activity_422(self, session, user_a):
        r = session.put(f"{API}/profile", json={"activity_level": "bogus"}, headers=auth(user_a["token"]))
        assert r.status_code == 422


# ---------- Intakes & Day ----------
class TestIntakes:
    def test_intake_crud_and_day_summary(self, session, user_a):
        today = date.today().isoformat()
        # set custom target 2000 for predictable progress
        session.put(f"{API}/profile", json={"target_mode": "custom", "daily_target": 2000},
                    headers=auth(user_a["token"]))

        # Add 3 intakes: 250, 500, 300
        ids = []
        for amt in (250, 500, 300):
            r = session.post(f"{API}/intakes", json={"amount_ml": amt, "local_date": today},
                             headers=auth(user_a["token"]))
            assert r.status_code == 200, r.text
            ids.append(r.json()["id"])

        day = session.get(f"{API}/day", params={"date": today}, headers=auth(user_a["token"]))
        assert day.status_code == 200
        d = day.json()
        assert d["total"] == 1050
        assert d["target"] == 2000
        assert d["remaining"] == 950
        assert d["progress"] in (52, 53)  # banker/round-half-even tolerance
        assert len(d["records"]) == 3

        # Update one intake
        upd = session.put(f"{API}/intakes/{ids[0]}", json={"amount_ml": 1000},
                          headers=auth(user_a["token"]))
        assert upd.status_code == 200
        assert upd.json()["amount_ml"] == 1000

        # Delete one intake
        dele = session.delete(f"{API}/intakes/{ids[1]}", headers=auth(user_a["token"]))
        assert dele.status_code == 200
        day2 = session.get(f"{API}/day", params={"date": today}, headers=auth(user_a["token"])).json()
        assert day2["total"] == 1000 + 300

        # Re-delete should 404
        again = session.delete(f"{API}/intakes/{ids[1]}", headers=auth(user_a["token"]))
        assert again.status_code == 404

    def test_progress_exceeds_100_remaining_zero(self, session, user_a):
        today = date.today().isoformat()
        # Add a large intake pushing total over target 2000
        session.post(f"{API}/intakes", json={"amount_ml": 3000, "local_date": today},
                     headers=auth(user_a["token"]))
        d = session.get(f"{API}/day", params={"date": today}, headers=auth(user_a["token"])).json()
        assert d["total"] > d["target"]
        assert d["remaining"] == 0
        assert d["progress"] > 100

    def test_invalid_amount_422(self, session, user_a):
        today = date.today().isoformat()
        r = session.post(f"{API}/intakes", json={"amount_ml": 0, "local_date": today},
                         headers=auth(user_a["token"]))
        assert r.status_code == 422
        r2 = session.post(f"{API}/intakes", json={"amount_ml": 6000, "local_date": today},
                          headers=auth(user_a["token"]))
        assert r2.status_code == 422


# ---------- Reports ----------
class TestReports:
    def test_weekly_report(self, session, user_a):
        end = date.today().isoformat()
        r = session.get(f"{API}/reports/weekly", params={"end_date": end}, headers=auth(user_a["token"]))
        assert r.status_code == 200
        b = r.json()
        assert len(b["days"]) == 7
        assert b["has_data"] is True
        assert b["trend"] in ("up", "down", "steady")
        assert "average" in b and "achieved_count" in b

    def test_weekly_empty_user(self, session, user_b):
        end = date.today().isoformat()
        r = session.get(f"{API}/reports/weekly", params={"end_date": end}, headers=auth(user_b["token"]))
        assert r.status_code == 200
        assert r.json()["has_data"] is False
        assert r.json()["average"] == 0

    def test_monthly_report(self, session, user_a):
        month = date.today().strftime("%Y-%m")
        r = session.get(f"{API}/reports/monthly", params={"month": month}, headers=auth(user_a["token"]))
        assert r.status_code == 200
        b = r.json()
        assert b["month"] == month
        assert isinstance(b["days"], list) and len(b["days"]) >= 28
        assert b["has_data"] is True
        statuses = {d["status"] for d in b["days"]}
        assert statuses.issubset({"none", "low", "partial", "achieved"})


# ---------- Reminders ----------
class TestReminders:
    def test_get_default_reminder(self, session, user_a):
        r = session.get(f"{API}/reminders", headers=auth(user_a["token"]))
        assert r.status_code == 200
        b = r.json()
        assert "enabled" in b and "interval_minutes" in b

    def test_update_enable_and_interval(self, session, user_a):
        r = session.put(f"{API}/reminders", json={
            "enabled": True, "interval_minutes": 90, "start_time": "08:00", "end_time": "22:00"
        }, headers=auth(user_a["token"]))
        assert r.status_code == 200
        b = r.json()
        assert b["enabled"] is True
        assert b["interval_minutes"] == 90
        assert b["start_time"] == "08:00"

    def test_pause_and_resume(self, session, user_a):
        future = "2099-12-31T23:59:00+00:00"
        r = session.put(f"{API}/reminders", json={"paused_until": future}, headers=auth(user_a["token"]))
        assert r.status_code == 200
        assert r.json()["paused_until"] == future
        # Resume: send empty string (API accepts and stores) — client resumes via GET+UI;
        # cleanest API path: send another ISO string that is past, but current API treats any string the same.
        # The spec: paused_until None resumes. The ReminderIn model allows setting paused_until explicitly.
        # Updating with explicit null in model_dump(exclude_unset=True): we need to pass paused_until=None
        r2 = session.put(f"{API}/reminders", json={"paused_until": None}, headers=auth(user_a["token"]))
        assert r2.status_code == 200
        assert r2.json()["paused_until"] in (None, "")

    def test_invalid_interval_422(self, session, user_a):
        r = session.put(f"{API}/reminders", json={"interval_minutes": 45}, headers=auth(user_a["token"]))
        assert r.status_code == 422


# ---------- Export ----------
class TestExport:
    def test_csv_export(self, session, user_a):
        r = session.get(f"{API}/export/csv", headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        lines = r.text.strip().split("\n")
        assert lines[0].startswith("date,time,amount_ml,daily_target_ml,note")
        assert len(lines) >= 2  # has records


# ---------- Data isolation ----------
class TestIsolation:
    def test_user_b_cannot_see_user_a_intakes(self, session, user_a, user_b):
        today = date.today().isoformat()
        b_list = session.get(f"{API}/intakes", params={"date": today}, headers=auth(user_b["token"]))
        assert b_list.status_code == 200
        assert b_list.json() == []  # user_b created no intakes

        b_day = session.get(f"{API}/day", params={"date": today}, headers=auth(user_b["token"]))
        assert b_day.status_code == 200
        assert b_day.json()["total"] == 0

    def test_user_b_cannot_modify_user_a_intake(self, session, user_a, user_b):
        today = date.today().isoformat()
        # fetch A's first intake
        a_list = session.get(f"{API}/intakes", params={"date": today}, headers=auth(user_a["token"])).json()
        if not a_list:
            pytest.skip("no intakes to probe")
        iid = a_list[0]["id"]
        r = session.delete(f"{API}/intakes/{iid}", headers=auth(user_b["token"]))
        assert r.status_code == 404
