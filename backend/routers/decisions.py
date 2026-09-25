"""Guided decision framework — dilemma, weighted options, 10/10/10, archive."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from lib.auth import require_user
from lib.db import db, prepare
from lib.timeutil import utcnow
from models.schemas import Decision, DecisionCreate, DecisionUpdate

router = APIRouter(prefix="/decisions", tags=["decisions"])


@router.get("", response_model=list[Decision])
async def list_decisions(user: dict = Depends(require_user)):
    docs = await db.decisions.find({"user_id": user["id"]}).sort("created_at", -1).to_list(200)
    return [Decision(**prepare(doc)) for doc in docs]


@router.post("", response_model=Decision)
async def create_decision(input: DecisionCreate, user: dict = Depends(require_user)):
    now = utcnow()
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **input.model_dump(), "status": "open", "chosen_option": None, "created_at": now, "updated_at": now}
    await db.decisions.insert_one(doc)
    return Decision(**prepare(doc))


@router.patch("/{decision_id}", response_model=Decision)
async def update_decision(decision_id: str, input: DecisionUpdate, user: dict = Depends(require_user)):
    updates = input.model_dump(exclude_unset=True)
    updates["updated_at"] = utcnow()
    doc = await db.decisions.find_one_and_update(
        {"id": decision_id, "user_id": user["id"]},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Decision not found")
    return Decision(**prepare(doc))


@router.delete("/{decision_id}")
async def delete_decision(decision_id: str, user: dict = Depends(require_user)):
    result = await db.decisions.delete_one({"id": decision_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Decision not found")
    return {"ok": True}
