"""HIBI NOMI backend — water intake tracker API.

Sections:
  - Setup & DB
  - Models
  - Auth helpers (session tokens, password hashing)
  - Business logic (target calculation, day aggregation)
  - Routes: auth / profile / intakes / reports / reminders / export
"""
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header, Query
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import logging
import uuid
import secrets
import bcrypt
import httpx
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="HIBI NOMI API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hibinomi")

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

ACTIVITY_LEVELS = {"sedentary", "light", "moderate", "active", "very_active"}
DEFAULT_PRESETS = [100, 200, 250, 300, 500]
MAX_PRESETS = 6
ACTIVITY_BONUS_ML = {
    "sedentary": 0,
    "light": 250,
    "moderate": 500,
    "active": 750,
    "very_active": 1000,
}


# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


# ---------------------------------------------------------------------------
# Business logic (kept separate from routes so it can change later)
# ---------------------------------------------------------------------------
def calculate_daily_target(weight_kg: Optional[float], activity_level: Optional[str]) -> int:
    """Compute a recommended daily water target in ml.

    base = weight * 35 ml  (falls back to 60kg if weight unknown)
    + activity bonus, rounded to nearest 50, clamped to [1500, 4000].
    """
    w = weight_kg if weight_kg and weight_kg > 0 else 60.0
    base = w * 35.0
    bonus = ACTIVITY_BONUS_ML.get(activity_level or "light", 250)
    total = base + bonus
    total = round(total / 50.0) * 50
    return int(min(max(total, 1500), 4000))


def classify_status(total: int, target: int) -> str:
    if total <= 0:
        return "none"
    pct = total / target if target else 0
    if pct >= 1.0:
        return "achieved"
    if pct >= 0.5:
        return "partial"
    return "low"


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str

    @field_validator("password")
    @classmethod
    def pw_len(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("name")
    @classmethod
    def name_len(cls, v):
        if not v.strip():
            raise ValueError("Name is required")
        return v.strip()


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SessionIn(BaseModel):
    session_id: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    reset_token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def pw_len(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class ProfileIn(BaseModel):
    name: Optional[str] = None
    weight: Optional[float] = None
    activity_level: Optional[str] = None
    wake_time: Optional[str] = None
    sleep_time: Optional[str] = None
    preferred_unit: Optional[str] = None
    target_mode: Optional[str] = None
    daily_target: Optional[int] = None
    onboarded: Optional[bool] = None
    quick_presets: Optional[List[int]] = None

    @field_validator("quick_presets")
    @classmethod
    def presets_ok(cls, v):
        if v is None:
            return v
        if not (1 <= len(v) <= MAX_PRESETS):
            raise ValueError(f"Choose between 1 and {MAX_PRESETS} presets")
        if any(a <= 0 or a > 5000 for a in v):
            raise ValueError("Each preset must be between 1 and 5000 ml")
        if len(set(v)) != len(v):
            raise ValueError("Presets must be unique")
        return sorted(v)


class CalcTargetIn(BaseModel):
    weight: Optional[float] = None
    activity_level: Optional[str] = None


class IntakeIn(BaseModel):
    amount_ml: int
    local_date: str
    consumed_at: Optional[str] = None
    note: Optional[str] = None

    @field_validator("amount_ml")
    @classmethod
    def amt(cls, v):
        if v <= 0 or v > 5000:
            raise ValueError("Amount must be between 1 and 5000 ml")
        return v


class IntakeUpdate(BaseModel):
    amount_ml: Optional[int] = None
    note: Optional[str] = None
    consumed_at: Optional[str] = None


class ReminderIn(BaseModel):
    enabled: Optional[bool] = None
    interval_minutes: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    paused_until: Optional[str] = None


# ---------------------------------------------------------------------------
# Serializers (never leak _id)
# ---------------------------------------------------------------------------
def public_user(u: dict) -> dict:
    return {
        "id": u["user_id"],
        "email": u.get("email"),
        "name": u.get("name"),
        "picture": u.get("picture"),
        "auth_provider": u.get("auth_provider", "email"),
    }


def public_profile(p: dict) -> dict:
    return {
        "name": p.get("name"),
        "weight": p.get("weight"),
        "activity_level": p.get("activity_level"),
        "wake_time": p.get("wake_time", "07:00"),
        "sleep_time": p.get("sleep_time", "23:00"),
        "preferred_unit": p.get("preferred_unit", "ml"),
        "target_mode": p.get("target_mode", "auto"),
        "daily_target": p.get("daily_target", 2000),
        "onboarded": p.get("onboarded", False),
        "quick_presets": p.get("quick_presets") or DEFAULT_PRESETS,
    }


def public_intake(i: dict) -> dict:
    return {
        "id": i["intake_id"],
        "amount_ml": i["amount_ml"],
        "local_date": i["local_date"],
        "consumed_at": i.get("consumed_at"),
        "note": i.get("note"),
    }


def public_reminder(r: dict) -> dict:
    return {
        "enabled": r.get("enabled", False),
        "interval_minutes": r.get("interval_minutes", 60),
        "start_time": r.get("start_time", "07:00"),
        "end_time": r.get("end_time", "23:00"),
        "paused_until": r.get("paused_until"),
    }


# ---------------------------------------------------------------------------
# Auth plumbing
# ---------------------------------------------------------------------------
async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one(
        {
            "session_token": token,
            "user_id": user_id,
            "created_at": now_utc(),
            "expires_at": now_utc() + timedelta(days=7),
        }
    )
    return token


async def ensure_profile(user_id: str, name: Optional[str] = None) -> dict:
    p = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if p:
        return p
    doc = {
        "user_id": user_id,
        "name": name,
        "weight": None,
        "activity_level": "light",
        "wake_time": "07:00",
        "sleep_time": "23:00",
        "preferred_unit": "ml",
        "target_mode": "auto",
        "daily_target": 2000,
        "onboarded": False,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.user_profiles.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


async def ensure_reminder(user_id: str) -> dict:
    r = await db.reminder_settings.find_one({"user_id": user_id}, {"_id": 0})
    if r:
        return r
    doc = {
        "user_id": user_id,
        "enabled": False,
        "interval_minutes": 60,
        "start_time": "07:00",
        "end_time": "23:00",
        "paused_until": None,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.reminder_settings.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = session.get("expires_at")
    if isinstance(exp, datetime):
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now_utc():
            raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one(
        {
            "user_id": user_id,
            "email": body.email.lower(),
            "name": body.name,
            "password_hash": hash_password(body.password),
            "auth_provider": "email",
            "picture": None,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
    )
    profile = await ensure_profile(user_id, body.name)
    await ensure_reminder(user_id)
    token = await create_session(user_id)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": token, "user": public_user(user), "profile": public_profile(profile)}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    profile = await ensure_profile(user["user_id"], user.get("name"))
    await ensure_reminder(user["user_id"])
    token = await create_session(user["user_id"])
    return {"session_token": token, "user": public_user(user), "profile": public_profile(profile)}


@api.post("/auth/session")
async def google_session(body: SessionIn):
    async with httpx.AsyncClient(timeout=20) as cx:
        resp = await cx.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    data = resp.json()
    email = (data.get("email") or "").lower()
    name = data.get("name")
    picture = data.get("picture")
    if not email:
        raise HTTPException(status_code=401, detail="Could not read account email")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "name": name,
                "password_hash": None,
                "auth_provider": "google",
                "picture": picture,
                "created_at": now_utc(),
                "updated_at": now_utc(),
            }
        )
    else:
        user_id = user["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"picture": picture, "updated_at": now_utc()}})
    profile = await ensure_profile(user_id, name)
    await ensure_reminder(user_id)
    token = await create_session(user_id)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": token, "user": public_user(user), "profile": public_profile(profile)}


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or user.get("auth_provider") == "google":
        return {"ok": True, "reset_token": None, "message": "If an account exists, a reset code has been issued."}
    reset_token = secrets.token_urlsafe(6)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"reset_token": reset_token, "reset_expires": now_utc() + timedelta(minutes=30)}},
    )
    return {"ok": True, "reset_token": reset_token, "message": "Use this code to reset your password."}


@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    user = await db.users.find_one({"reset_token": body.reset_token}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    exp = user.get("reset_expires")
    if isinstance(exp, datetime):
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now_utc():
            raise HTTPException(status_code=400, detail="Reset code has expired")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "updated_at": now_utc()},
         "$unset": {"reset_token": "", "reset_expires": ""}},
    )
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    profile = await ensure_profile(user["user_id"], user.get("name"))
    return {"user": public_user(user), "profile": public_profile(profile)}


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Profile routes
# ---------------------------------------------------------------------------
@api.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    p = await ensure_profile(user["user_id"], user.get("name"))
    return public_profile(p)


@api.put("/profile")
async def update_profile(body: ProfileIn, user: dict = Depends(get_current_user)):
    p = await ensure_profile(user["user_id"], user.get("name"))
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "activity_level" in updates and updates["activity_level"] not in ACTIVITY_LEVELS:
        raise HTTPException(status_code=422, detail="Invalid activity level")
    if "preferred_unit" in updates and updates["preferred_unit"] not in ("ml", "l"):
        raise HTTPException(status_code=422, detail="Invalid unit")
    if "target_mode" in updates and updates["target_mode"] not in ("auto", "custom"):
        raise HTTPException(status_code=422, detail="Invalid target mode")

    if updates.get("target_mode") == "auto":
        weight = updates.get("weight", p.get("weight"))
        activity = updates.get("activity_level", p.get("activity_level"))
        updates["daily_target"] = calculate_daily_target(weight, activity)

    if "name" in updates and updates["name"]:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"name": updates["name"]}})

    updates["updated_at"] = now_utc()
    await db.user_profiles.update_one({"user_id": user["user_id"]}, {"$set": updates})
    p = await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return public_profile(p)


@api.post("/profile/calculate-target")
async def calc_target(body: CalcTargetIn, user: dict = Depends(get_current_user)):
    p = await ensure_profile(user["user_id"], user.get("name"))
    weight = body.weight if body.weight is not None else p.get("weight")
    activity = body.activity_level if body.activity_level is not None else p.get("activity_level")
    return {"calculated_target": calculate_daily_target(weight, activity)}


# ---------------------------------------------------------------------------
# Intake routes
# ---------------------------------------------------------------------------
@api.post("/intakes")
async def add_intake(body: IntakeIn, user: dict = Depends(get_current_user)):
    intake_id = f"wi_{uuid.uuid4().hex[:12]}"
    doc = {
        "intake_id": intake_id,
        "user_id": user["user_id"],
        "amount_ml": body.amount_ml,
        "local_date": body.local_date,
        "consumed_at": body.consumed_at or iso(now_utc()),
        "note": body.note,
        "created_at": now_utc(),
        "updated_at": now_utc(),
        "deleted_at": None,
    }
    await db.water_intakes.insert_one(dict(doc))
    return public_intake(doc)


@api.get("/intakes")
async def list_intakes(date_: str = Query(..., alias="date"), user: dict = Depends(get_current_user)):
    cur = db.water_intakes.find(
        {"user_id": user["user_id"], "local_date": date_, "deleted_at": None}, {"_id": 0}
    )
    rows = await cur.to_list(1000)
    rows.sort(key=lambda r: r.get("consumed_at") or "")
    return [public_intake(r) for r in rows]


@api.put("/intakes/{intake_id}")
async def update_intake(intake_id: str, body: IntakeUpdate, user: dict = Depends(get_current_user)):
    existing = await db.water_intakes.find_one(
        {"intake_id": intake_id, "user_id": user["user_id"], "deleted_at": None}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Record not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "amount_ml" in updates and (updates["amount_ml"] <= 0 or updates["amount_ml"] > 5000):
        raise HTTPException(status_code=422, detail="Amount must be between 1 and 5000 ml")
    updates["updated_at"] = now_utc()
    await db.water_intakes.update_one(
        {"intake_id": intake_id, "user_id": user["user_id"]}, {"$set": updates}
    )
    doc = await db.water_intakes.find_one({"intake_id": intake_id}, {"_id": 0})
    return public_intake(doc)


@api.delete("/intakes/{intake_id}")
async def delete_intake(intake_id: str, user: dict = Depends(get_current_user)):
    res = await db.water_intakes.update_one(
        {"intake_id": intake_id, "user_id": user["user_id"], "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"ok": True}


@api.get("/day")
async def day_summary(date_: str = Query(..., alias="date"), user: dict = Depends(get_current_user)):
    p = await ensure_profile(user["user_id"], user.get("name"))
    target = int(p.get("daily_target", 2000))
    cur = db.water_intakes.find(
        {"user_id": user["user_id"], "local_date": date_, "deleted_at": None}, {"_id": 0}
    )
    rows = await cur.to_list(2000)
    rows.sort(key=lambda r: r.get("consumed_at") or "")
    total = sum(r["amount_ml"] for r in rows)
    remaining = max(target - total, 0)
    progress = round((total / target) * 100) if target else 0
    return {
        "date": date_,
        "total": total,
        "target": target,
        "remaining": remaining,
        "progress": progress,
        "unit": p.get("preferred_unit", "ml"),
        "records": [public_intake(r) for r in rows],
    }


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------
def daterange(start: date, days: int) -> List[str]:
    return [(start + timedelta(days=i)).isoformat() for i in range(days)]


@api.get("/reports/weekly")
async def weekly_report(end_date: str = Query(...), user: dict = Depends(get_current_user)):
    p = await ensure_profile(user["user_id"], user.get("name"))
    target = int(p.get("daily_target", 2000))
    end = date.fromisoformat(end_date)
    start = end - timedelta(days=6)
    days = daterange(start, 7)
    cur = db.water_intakes.find(
        {"user_id": user["user_id"], "local_date": {"$in": days}, "deleted_at": None},
        {"_id": 0, "local_date": 1, "amount_ml": 1},
    )
    rows = await cur.to_list(5000)
    totals = {d: 0 for d in days}
    for r in rows:
        totals[r["local_date"]] = totals.get(r["local_date"], 0) + r["amount_ml"]

    day_list = [{"date": d, "total": totals[d], "target": target, "achieved": totals[d] >= target} for d in days]
    data_days = [d for d in day_list if d["total"] > 0]
    total_sum = sum(d["total"] for d in day_list)
    average = round(total_sum / 7)
    achieved_count = sum(1 for d in day_list if d["achieved"])
    highest = max(day_list, key=lambda d: d["total"]) if total_sum > 0 else None
    lowest = min(data_days, key=lambda d: d["total"]) if data_days else None
    first_half = sum(d["total"] for d in day_list[:3]) / 3
    second_half = sum(d["total"] for d in day_list[4:]) / 3
    trend = "steady"
    if second_half > first_half * 1.1:
        trend = "up"
    elif second_half < first_half * 0.9:
        trend = "down"
    return {
        "days": day_list,
        "average": average,
        "target": target,
        "achieved_count": achieved_count,
        "missed_count": 7 - achieved_count,
        "highest": highest,
        "lowest": lowest,
        "trend": trend,
        "has_data": total_sum > 0,
        "unit": p.get("preferred_unit", "ml"),
    }


@api.get("/reports/monthly")
async def monthly_report(month: str = Query(...), user: dict = Depends(get_current_user)):
    p = await ensure_profile(user["user_id"], user.get("name"))
    target = int(p.get("daily_target", 2000))
    year, mon = int(month[:4]), int(month[5:7])
    first = date(year, mon, 1)
    nxt = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    num_days = (nxt - first).days
    days = daterange(first, num_days)
    cur = db.water_intakes.find(
        {"user_id": user["user_id"], "local_date": {"$in": days}, "deleted_at": None},
        {"_id": 0, "local_date": 1, "amount_ml": 1},
    )
    rows = await cur.to_list(20000)
    totals = {d: 0 for d in days}
    for r in rows:
        totals[r["local_date"]] = totals.get(r["local_date"], 0) + r["amount_ml"]

    day_list = []
    for d in days:
        t = totals[d]
        pct = round((t / target) * 100) if target else 0
        day_list.append({"date": d, "total": t, "target": target, "percentage": pct, "status": classify_status(t, target)})

    data_days = [d for d in day_list if d["total"] > 0]
    monthly_total = sum(d["total"] for d in day_list)
    monthly_average = round(monthly_total / len(data_days)) if data_days else 0
    success_days = sum(1 for d in day_list if d["total"] >= target)
    unsuccessful_days = sum(1 for d in data_days if d["total"] < target)
    highest = max(data_days, key=lambda d: d["total"]) if data_days else None
    lowest = min(data_days, key=lambda d: d["total"]) if data_days else None

    weekly_averages = []
    for i in range(0, len(day_list), 7):
        chunk = day_list[i : i + 7]
        wd = [c for c in chunk if c["total"] > 0]
        avg = round(sum(c["total"] for c in wd) / len(wd)) if wd else 0
        weekly_averages.append(avg)

    return {
        "month": month,
        "days": day_list,
        "monthly_total": monthly_total,
        "monthly_average": monthly_average,
        "success_days": success_days,
        "unsuccessful_days": unsuccessful_days,
        "highest": highest,
        "lowest": lowest,
        "weekly_averages": weekly_averages,
        "has_data": monthly_total > 0,
        "target": target,
        "unit": p.get("preferred_unit", "ml"),
    }


# ---------------------------------------------------------------------------
# Reminders
# ---------------------------------------------------------------------------
@api.get("/reminders")
async def get_reminders(user: dict = Depends(get_current_user)):
    r = await ensure_reminder(user["user_id"])
    return public_reminder(r)


@api.put("/reminders")
async def update_reminders(body: ReminderIn, user: dict = Depends(get_current_user)):
    await ensure_reminder(user["user_id"])
    data = body.model_dump(exclude_unset=True)
    updates = {}
    for k in ("enabled", "interval_minutes", "start_time", "end_time", "paused_until"):
        if k in data:
            updates[k] = data[k]
    if "interval_minutes" in updates and updates["interval_minutes"] not in (30, 60, 90, 120, 180):
        raise HTTPException(status_code=422, detail="Invalid interval")
    updates["updated_at"] = now_utc()
    await db.reminder_settings.update_one({"user_id": user["user_id"]}, {"$set": updates})
    r = await db.reminder_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return public_reminder(r)


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
@api.get("/export/csv")
async def export_csv(user: dict = Depends(get_current_user)):
    p = await ensure_profile(user["user_id"], user.get("name"))
    target = int(p.get("daily_target", 2000))
    cur = db.water_intakes.find({"user_id": user["user_id"], "deleted_at": None}, {"_id": 0})
    rows = await cur.to_list(100000)
    rows.sort(key=lambda r: (r.get("local_date") or "", r.get("consumed_at") or ""))
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date", "time", "amount_ml", "daily_target_ml", "note"])
    for r in rows:
        consumed = r.get("consumed_at") or ""
        time_part = consumed[11:16] if len(consumed) >= 16 else ""
        writer.writerow([r.get("local_date", ""), time_part, r.get("amount_ml", 0), target, (r.get("note") or "")])
    return PlainTextResponse(buf.getvalue(), media_type="text/csv")


@api.get("/")
async def root():
    return {"app": "HIBI NOMI", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.water_intakes.create_index([("user_id", 1), ("local_date", 1)])
    await db.user_profiles.create_index("user_id", unique=True)
    await db.reminder_settings.create_index("user_id", unique=True)
    logger.info("HIBI NOMI backend ready")


@app.on_event("shutdown")
async def shutdown():
    client.close()
