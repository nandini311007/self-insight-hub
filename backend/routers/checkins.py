"""Weekly life check-in — one guided review per ISO week, upserted."""

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pymongo import ReturnDocument

from lib.auth import require_user
from lib.dates import today_iso
from lib.db import db, prepare
from lib.timeutil import utcnow
from models.schemas import WeeklyCheckIn, WeeklyCheckInCreate, WeeklyCheckInWindow

router = APIRouter(prefix="/checkins", tags=["checkins"])


def _week_start(day: date) -> str:
    """Monday of that day's week, as YYYY-MM-DD."""
    return (day - timedelta(days=day.weekday())).isoformat()


@router.get("/window", response_model=WeeklyCheckInWindow)
async def window(user: dict = Depends(require_user)):
    """Which week we're reviewing, and whether it's already done."""
    today = date.fromisoformat(today_iso())
    start = _week_start(today)
    end = (date.fromisoformat(start) + timedelta(days=6)).isoformat()
    existing = await db.weekly_checkins.find_one({"user_id": user["id"], "week_start": start})
    return WeeklyCheckInWindow(
        week_start=start,
        week_end=end,
        is_sunday=today.weekday() == 6,
        completed=existing is not None,
        today=today.isoformat(),
    )


@router.get("", response_model=list[WeeklyCheckIn])
async def list_checkins(user: dict = Depends(require_user)):
    docs = await db.weekly_checkins.find({"user_id": user["id"]}).sort("week_start", -1).to_list(200)
    return [WeeklyCheckIn(**prepare(doc)) for doc in docs]


@router.post("", response_model=WeeklyCheckIn)
async def upsert_checkin(input: WeeklyCheckInCreate, user: dict = Depends(require_user)):
    start = input.week_start or _week_start(date.fromisoformat(today_iso()))
    fields = input.model_dump(exclude={"week_start"})
    existing = await db.weekly_checkins.find_one({"user_id": user["id"], "week_start": start})
    if existing is None:
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "week_start": start,
            **fields,
            "created_at": utcnow(),
            "updated_at": utcnow(),
        }
        await db.weekly_checkins.insert_one(doc)
    else:
        doc = await db.weekly_checkins.find_one_and_update(
            {"id": existing["id"]},
            {"$set": {**fields, "updated_at": utcnow()}},
            return_document=ReturnDocument.AFTER,
        )
    return WeeklyCheckIn(**prepare(doc))
