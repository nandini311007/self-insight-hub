"""Platform cron endpoints. Auth is a bearer secret; work is always backgrounded."""

import hmac
import logging
import os
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException

from lib.db import db
from lib.email import reminder_html, send_email
from lib.prompts import daily_prompt
from lib.timeutil import utcnow

router = APIRouter(prefix="/cron", tags=["cron"])
logger = logging.getLogger(__name__)


def _authorize(authorization: str | None) -> None:
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not secret:
        raise HTTPException(status_code=401, detail="unauthorized")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    if not hmac.compare_digest(authorization.removeprefix("Bearer ").strip(), secret):
        raise HTTPException(status_code=401, detail="unauthorized")


async def _streak_for(user_id: str) -> int:
    from routers.dashboard import _streaks

    entries = await db.journal_entries.find({"user_id": user_id}, {"entry_date": 1}).to_list(500)
    moods = await db.mood_logs.find({"user_id": user_id}, {"date": 1}).to_list(180)
    dates = {e["entry_date"] for e in entries} | {m["date"] for m in moods}
    return _streaks(dates)[0]


async def send_due_reminders(run_id: str) -> None:
    """Send one nudge per opted-in user whose local reminder hour is now."""
    sent = 0
    cursor = db.users.find({"reminder_enabled": True})
    async for user in cursor:
        try:
            tz_name = user.get("reminder_tz") or "UTC"
            try:
                tz = ZoneInfo(tz_name)
            except (ZoneInfoNotFoundError, ValueError):
                tz = ZoneInfo("UTC")
            local = datetime.now(tz)
            if local.hour != int(user.get("reminder_hour", 20)):
                continue
            today_local = local.strftime("%Y-%m-%d")
            if user.get("last_reminder_date") == today_local:
                continue  # idempotent: one nudge per local day

            await send_email(
                to=user["email"],
                subject="Your daily reflection is waiting",
                html=reminder_html(
                    name=user.get("name", ""),
                    prompt=daily_prompt(today_local),
                    streak=await _streak_for(user["id"]),
                ),
            )
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"last_reminder_date": today_local, "last_reminder_at": utcnow()}},
            )
            sent += 1
        except Exception as exc:  # one bad recipient must not stop the run
            logger.error("reminder failed for %s: %s", user.get("email"), exc)
    logger.info("cron %s sent %s reminder(s)", run_id, sent)


@router.post("/reminders")
async def reminders(
    background_tasks: BackgroundTasks,
    payload: dict | None = None,
    authorization: str | None = Header(default=None),
):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    _authorize(authorization)
    run_id = (payload or {}).get("run_id") or "manual"
    background_tasks.add_task(send_due_reminders, run_id)
    return {"accepted": True, "run_id": run_id}
