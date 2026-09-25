"""Progress dashboard: streaks, badges, mood series, recent reflections."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends

from lib.auth import require_user
from lib.dates import today_iso
from lib.db import db, prepare
from lib.prompts import MOOD_SCORES
from models.schemas import Badge, DashboardOut, JournalEntry, MoodPoint, StreakOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _streaks(dates: set[str]) -> tuple[int, int]:
    """(current streak ending today-or-yesterday, longest streak) from YYYY-MM-DD strings."""
    if not dates:
        return 0, 0
    days = sorted(date.fromisoformat(d) for d in dates)
    longest = current = 1
    for prev, day in zip(days, days[1:]):
        current = current + 1 if (day - prev).days == 1 else 1
        longest = max(longest, current)
    today = date.fromisoformat(today_iso())
    known = set(days)
    yesterday = today - timedelta(days=1)
    start = today if today in known else (yesterday if yesterday in known else None)
    if start is None:
        return 0, longest
    streak = 0
    while start in known:
        streak += 1
        start -= timedelta(days=1)
    return streak, longest


def _badges(total_entries: int, total_moods: int, longest: int, has_values: bool, decisions_count: int, posts_count: int) -> list[Badge]:
    return [
        Badge(key="first-reflection", label="First Reflection", description="Write your first journal entry", earned=total_entries >= 1),
        Badge(key="three-day-streak", label="3-Day Streak", description="Reflect three days in a row", earned=longest >= 3),
        Badge(key="week-streak", label="7-Day Streak", description="Reflect seven days in a row", earned=longest >= 7),
        Badge(key="deep-diver", label="Deep Diver", description="Write ten journal entries", earned=total_entries >= 10),
        Badge(key="mood-explorer", label="Mood Explorer", description="Log your mood five times", earned=total_moods >= 5),
        Badge(key="values-compass", label="Values Compass", description="Complete the values discovery", earned=has_values),
        Badge(key="decision-maker", label="Decision Maker", description="Work through a guided decision", earned=decisions_count >= 1),
        Badge(key="community-voice", label="Community Voice", description="Share a reflection with the community", earned=posts_count >= 1),
    ]


@router.get("", response_model=DashboardOut)
async def dashboard(user: dict = Depends(require_user)):
    uid = user["id"]
    entries = await db.journal_entries.find({"user_id": uid}).sort("created_at", -1).to_list(500)
    moods = await db.mood_logs.find({"user_id": uid}).sort("date", -1).to_list(180)
    values_doc = await db.values_results.find_one({"user_id": uid}, sort=[("created_at", -1)])
    decisions_count = await db.decisions.count_documents({"user_id": uid})
    posts_count = await db.community_posts.count_documents({"user_id": uid})

    dates = {e["entry_date"] for e in entries} | {m["date"] for m in moods}
    streak, longest = _streaks(dates)

    moods_by_date = {m["date"]: m["mood"] for m in moods}
    today = date.fromisoformat(today_iso())
    mood_series = []
    for offset in range(13, -1, -1):
        day = (today - timedelta(days=offset)).isoformat()
        mood = moods_by_date.get(day)
        mood_series.append(MoodPoint(date=day, mood=mood, score=MOOD_SCORES.get(mood) if mood else None))

    badges = _badges(len(entries), len(moods), longest, values_doc is not None, decisions_count, posts_count)
    recent = [JournalEntry(**prepare(e)) for e in entries[:3]]
    return DashboardOut(
        streak=streak,
        longest_streak=longest,
        total_entries=len(entries),
        total_moods=len(moods),
        badges=badges,
        mood_series=mood_series,
        recent_entries=recent,
        values_top=(values_doc or {}).get("top_values", []),
    )


@router.get("/streak", response_model=StreakOut)
async def streak(user: dict = Depends(require_user)):
    uid = user["id"]
    entries = await db.journal_entries.find({"user_id": uid}, {"entry_date": 1}).to_list(500)
    moods = await db.mood_logs.find({"user_id": uid}, {"date": 1}).to_list(180)
    dates = {e["entry_date"] for e in entries} | {m["date"] for m in moods}
    return StreakOut(streak=_streaks(dates)[0])
