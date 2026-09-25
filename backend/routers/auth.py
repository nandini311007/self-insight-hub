"""Auth: email+password, Google (Emergent Auth), account settings, reminder prefs."""

import os
import uuid

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from lib.auth import (
    create_session,
    destroy_session,
    get_current_user,
    hash_password,
    require_user,
    verify_password,
)
from lib.db import db, prepare
from lib.timeutil import utcnow
from models.schemas import (
    EmailUpdate,
    GoogleSessionIn,
    LoginIn,
    MeOut,
    PasswordUpdate,
    ProfileUpdate,
    ReminderUpdate,
    SignupIn,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Emergent Auth session exchange. Constant, not an env var, so it survives deployment.
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


def _user_out(doc: dict) -> UserOut:
    return UserOut(
        id=doc["id"],
        email=doc["email"],
        name=doc["name"],
        picture=doc.get("picture", "") or "",
        has_password=bool(doc.get("password_hash")),
        auth_provider=doc.get("auth_provider", "password"),
        reminder_enabled=bool(doc.get("reminder_enabled", False)),
        reminder_hour=int(doc.get("reminder_hour", 20)),
        reminder_tz=doc.get("reminder_tz") or "UTC",
        created_at=doc["created_at"],
    )


@router.post("/signup", response_model=UserOut)
async def signup(input: SignupIn, response: Response):
    email = input.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists — try signing in instead")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": input.name.strip() or email.split("@")[0],
        "password_hash": hash_password(input.password),
        "picture": "",
        "auth_provider": "password",
        "reminder_enabled": False,
        "reminder_hour": 20,
        "reminder_tz": "UTC",
        "created_at": utcnow(),
    }
    await db.users.insert_one(doc)
    await create_session(response, doc["id"])
    return _user_out(prepare(doc))


@router.post("/login", response_model=UserOut)
async def login(input: LoginIn, response: Response):
    email = input.email.lower().strip()
    doc = await db.users.find_one({"email": email})
    if doc is None or not doc.get("password_hash") or not verify_password(input.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="That email and password don't match our records")
    await create_session(response, doc["id"])
    return _user_out(prepare(doc))


@router.post("/google/session", response_model=UserOut)
async def google_session(input: GoogleSessionIn, response: Response):
    """Exchange a one-time Emergent Auth session_id for our own cookie session.

    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    (the redirect URL is built in the frontend from window.location.origin).
    """
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": input.session_id})
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach the sign-in service — please try again")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="That Google sign-in link has expired — please try again")

    data = resp.json()
    email = str(data.get("email", "")).lower().strip()
    if not email:
        raise HTTPException(status_code=401, detail="Google sign-in did not return an email address")

    existing = await db.users.find_one({"email": email})
    if existing is None:
        doc = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": str(data.get("name") or email.split("@")[0]),
            "password_hash": "",  # Google-only account: no app-managed password
            "picture": str(data.get("picture") or ""),
            "auth_provider": "google",
            "reminder_enabled": False,
            "reminder_hour": 20,
            "reminder_tz": "UTC",
            "created_at": utcnow(),
        }
        await db.users.insert_one(doc)
    else:
        # Same email as an existing account — link Google to it rather than duplicating.
        updates = {"picture": str(data.get("picture") or existing.get("picture", ""))}
        if not existing.get("name"):
            updates["name"] = str(data.get("name") or email.split("@")[0])
        await db.users.update_one({"id": existing["id"]}, {"$set": updates})
        doc = await db.users.find_one({"id": existing["id"]})

    await create_session(response, doc["id"])
    return _user_out(prepare(doc))


@router.post("/logout")
async def logout(request: Request, response: Response):
    await destroy_session(request, response)
    return {"ok": True}


@router.get("/me", response_model=MeOut)
async def me(request: Request):
    doc = await get_current_user(request)
    if doc is None:
        return MeOut(user=None)
    return MeOut(user=_user_out(prepare(doc)))


@router.patch("/profile", response_model=UserOut)
async def update_profile(input: ProfileUpdate, request: Request):
    user = await require_user(request)
    await db.users.update_one({"id": user["id"]}, {"$set": {"name": input.name.strip()}})
    return _user_out(prepare(await db.users.find_one({"id": user["id"]})))


@router.patch("/email", response_model=UserOut)
async def update_email(input: EmailUpdate, request: Request):
    user = await require_user(request)
    email = input.email.lower().strip()
    if user.get("password_hash") and not verify_password(input.current_password, user["password_hash"]):
        raise HTTPException(status_code=403, detail="That password is incorrect")
    clash = await db.users.find_one({"email": email, "id": {"$ne": user["id"]}})
    if clash:
        raise HTTPException(status_code=409, detail="Another account already uses that email")
    await db.users.update_one({"id": user["id"]}, {"$set": {"email": email}})
    return _user_out(prepare(await db.users.find_one({"id": user["id"]})))


@router.patch("/password", response_model=UserOut)
async def update_password(input: PasswordUpdate, request: Request):
    user = await require_user(request)
    # Google-only accounts have no password yet, so they may set one without supplying one.
    if user.get("password_hash") and not verify_password(input.current_password, user["password_hash"]):
        raise HTTPException(status_code=403, detail="That current password is incorrect")
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"password_hash": hash_password(input.new_password)}}
    )
    return _user_out(prepare(await db.users.find_one({"id": user["id"]})))


@router.patch("/reminders", response_model=UserOut)
async def update_reminders(input: ReminderUpdate, request: Request):
    user = await require_user(request)
    await db.users.update_one({"id": user["id"]}, {"$set": input.model_dump()})
    return _user_out(prepare(await db.users.find_one({"id": user["id"]})))


@router.post("/reminders/test")
async def send_test_reminder(request: Request):
    """Send the nudge to the signed-in user's own address so they can see it."""
    user = await require_user(request)
    from lib.dates import today_iso
    from lib.email import reminder_html, send_email
    from lib.prompts import daily_prompt
    from routers.cron import _streak_for

    email_id = await send_email(
        to=user["email"],
        subject="Your daily reflection is waiting",
        html=reminder_html(
            name=user.get("name", ""),
            prompt=daily_prompt(today_iso()),
            streak=await _streak_for(user["id"]),
        ),
    )
    return {"ok": True, "email_id": email_id, "sent_to": user["email"]}
