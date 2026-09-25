"""Email auth: signup, login, logout, me — sessions ride httpOnly cookies, never JSON tokens."""

import uuid

from fastapi import APIRouter, Request, Response

from lib.auth import (
    create_session,
    destroy_session,
    get_current_user,
    hash_password,
    verify_password,
)
from lib.db import db, prepare
from lib.timeutil import utcnow
from models.schemas import LoginIn, MeOut, SignupIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(doc: dict) -> UserOut:
    return UserOut(id=doc["id"], email=doc["email"], name=doc["name"], created_at=doc["created_at"])


@router.post("/signup", response_model=UserOut)
async def signup(input: SignupIn, response: Response):
    email = input.email.lower().strip()
    if await db.users.find_one({"email": email}):
        from fastapi import HTTPException

        raise HTTPException(status_code=409, detail="An account with this email already exists — try signing in instead")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": input.name.strip() or email.split("@")[0],
        "password_hash": hash_password(input.password),
        "created_at": utcnow(),
    }
    await db.users.insert_one(doc)
    await create_session(response, doc["id"])
    return _user_out(prepare(doc))


@router.post("/login", response_model=UserOut)
async def login(input: LoginIn, response: Response):
    email = input.email.lower().strip()
    doc = await db.users.find_one({"email": email})
    if doc is None or not verify_password(input.password, doc.get("password_hash", "")):
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail="That email and password don't match our records")
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
