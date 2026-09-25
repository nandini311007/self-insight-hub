"""Personal values compass — save the ranked result, read the latest."""

import uuid

from fastapi import APIRouter, Depends
from typing import Optional

from lib.auth import require_user
from lib.db import db, prepare
from lib.timeutil import utcnow
from models.schemas import ValuesResult, ValuesSave

router = APIRouter(prefix="/values", tags=["values"])


@router.get("/result", response_model=Optional[ValuesResult])
async def get_result(user: dict = Depends(require_user)):
    doc = await db.values_results.find_one({"user_id": user["id"]}, sort=[("created_at", -1)])
    return ValuesResult(**prepare(doc)) if doc else None


@router.post("/result", response_model=ValuesResult)
async def save_result(input: ValuesSave, user: dict = Depends(require_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **input.model_dump(), "created_at": utcnow()}
    await db.values_results.insert_one(doc)
    return ValuesResult(**prepare(doc))
