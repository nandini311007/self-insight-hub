"""Email + password auth: pbkdf2 hashes in Mongo, httpOnly cookie sessions."""

import secrets
from datetime import timedelta, timezone

from fastapi import HTTPException, Request, Response
from passlib.context import CryptContext

from lib.db import db
from lib.timeutil import utcnow

COOKIE_NAME = "sih_session"
SESSION_TTL_DAYS = 30

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], pbkdf2_sha256__rounds=24_000)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


def _cookie_kwargs() -> dict:
    # SameSite=None keeps the session alive when the preview is embedded cross-site;
    # browsers require Secure alongside None, and Chromium treats localhost as secure.
    return {"httponly": True, "samesite": "none", "secure": True, "path": "/"}


async def create_session(response: Response, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = utcnow() + timedelta(days=SESSION_TTL_DAYS)
    await db.sessions.insert_one(
        {"token": token, "user_id": user_id, "expires_at": expires_at, "created_at": utcnow()}
    )
    response.set_cookie(COOKIE_NAME, token, max_age=SESSION_TTL_DAYS * 86_400, **_cookie_kwargs())
    return token


async def destroy_session(request: Request, response: Response) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        await db.sessions.delete_one({"token": token})
    response.delete_cookie(COOKIE_NAME, **_cookie_kwargs())


async def get_current_user(request: Request) -> dict | None:
    """The signed-in user's document, or None — being anonymous is a normal state, not an error."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    session = await db.sessions.find_one({"token": token})
    if session is None:
        return None
    expires_at = session.get("expires_at")
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < utcnow():
            await db.sessions.delete_one({"_id": session["_id"]})
            return None
    return await db.users.find_one({"id": session["user_id"]})


async def require_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Please sign in to continue")
    return user
