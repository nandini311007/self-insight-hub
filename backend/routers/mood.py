"""Daily mood check-ins — one log per day, upserted."""

import uuid

from fastapi import APIRouter, Depends
from pymongo import ReturnDocument

from lib.auth import require_user
from lib.dates import today_iso
from lib.db import db, prepare
from lib.timeutil import utcnow
from models.schemas import MoodLog, MoodLogCreate

router = APIRouter(prefix="/mood", tags=["mood"])


@router.get("", response_model=list[MoodLog])
async def list_moods(user: dict = Depends(require_user)):
    docs = await db.mood_logs.find({"user_id": user["id"]}).sort("date", -1).to_list(180)
    return [MoodLog(**prepare(doc)) for doc in docs]


@router.post("", response_model=MoodLog)
async def upsert_mood(input: MoodLogCreate, user: dict = Depends(require_user)):
    date = input.date or today_iso()
    doc = await db.mood_logs.find_one({"user_id": user["id"], "date": date})
    if doc is None:
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "date": date,
            "mood": input.mood,
            "energy": input.energy,
            "note": input.note,
            "created_at": utcnow(),
        }
        await db.mood_logs.insert_one(doc)
    else:
        doc = await db.mood_logs.find_one_and_update(
            {"id": doc["id"]},
            {"$set": {"mood": input.mood, "energy": input.energy, "note": input.note}},
            return_document=ReturnDocument.AFTER,
        )
    return MoodLog(**prepare(doc))
