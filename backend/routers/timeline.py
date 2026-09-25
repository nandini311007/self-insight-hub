"""Growth timeline — one chronological feed across every kind of reflection."""

from fastapi import APIRouter, Depends

from lib.auth import require_user
from lib.db import db, prepare
from lib.prompts import MOOD_SCORES
from models.schemas import TimelineItem, TimelineOut

router = APIRouter(prefix="/timeline", tags=["timeline"])

MOOD_LABEL = {"joyful": "Joyful", "calm": "Calm", "reflective": "Reflective", "anxious": "Anxious", "drained": "Drained"}
CATEGORY_LABEL = {
    "daily_prompt": "Daily prompt",
    "freeform": "Freeform",
    "milestone": "Milestone",
    "decision": "Decision",
}


@router.get("", response_model=TimelineOut)
async def timeline(user: dict = Depends(require_user)):
    uid = user["id"]
    items: list[TimelineItem] = []

    for doc in await db.journal_entries.find({"user_id": uid}).sort("created_at", -1).to_list(400):
        d = prepare(doc)
        items.append(
            TimelineItem(
                id=d["id"],
                kind="milestone" if d.get("category") == "milestone" else "entry",
                date=d["entry_date"],
                at=d["created_at"],
                title=d["title"],
                body=d["content"][:400],
                meta=CATEGORY_LABEL.get(d.get("category", ""), "Reflection"),
                mood=d.get("mood"),
            )
        )

    for doc in await db.mood_logs.find({"user_id": uid}).sort("date", -1).to_list(200):
        d = prepare(doc)
        items.append(
            TimelineItem(
                id=d["id"],
                kind="mood",
                date=d["date"],
                at=d["created_at"],
                title=f"Felt {MOOD_LABEL.get(d['mood'], d['mood']).lower()}",
                body=d.get("note", ""),
                meta=f"Energy {d['energy']}/10 · valence {MOOD_SCORES.get(d['mood'], 3)}/5",
                mood=d["mood"],
            )
        )

    for doc in await db.weekly_checkins.find({"user_id": uid}).sort("week_start", -1).to_list(200):
        d = prepare(doc)
        body = " · ".join(filter(None, [d.get("wins", ""), d.get("struggles", ""), d.get("intention", "")]))
        items.append(
            TimelineItem(
                id=d["id"],
                kind="checkin",
                date=d["week_start"],
                at=d["created_at"],
                title=f"Weekly check-in — alignment {d.get('alignment', 0)}/10",
                body=body[:400],
                meta="Weekly review",
                mood=None,
            )
        )

    for doc in await db.decisions.find({"user_id": uid}).sort("created_at", -1).to_list(200):
        d = prepare(doc)
        items.append(
            TimelineItem(
                id=d["id"],
                kind="decision",
                date=d["created_at"].date().isoformat(),
                at=d["created_at"],
                title=d["title"],
                body=d["dilemma"][:400],
                meta=f"Chose: {d['chosen_option']}" if d.get("chosen_option") else "Open decision",
                mood=None,
            )
        )

    for doc in await db.values_results.find({"user_id": uid}).sort("created_at", -1).to_list(50):
        d = prepare(doc)
        items.append(
            TimelineItem(
                id=d["id"],
                kind="values",
                date=d["created_at"].date().isoformat(),
                at=d["created_at"],
                title="Values compass set",
                body=", ".join(d.get("top_values", [])),
                meta=f"Alignment {d['alignment']}/10" if d.get("alignment") else "Values discovery",
                mood=None,
            )
        )

    items.sort(key=lambda i: i.at, reverse=True)
    return TimelineOut(items=items)
