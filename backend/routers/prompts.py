"""Prompt of the day — deterministic, the same question for the whole community."""

from fastapi import APIRouter, Depends

from lib.auth import require_user
from lib.dates import today_iso
from lib.prompts import daily_prompt
from models.schemas import DailyPrompt

router = APIRouter(prefix="/prompts", tags=["prompts"])


@router.get("/daily", response_model=DailyPrompt)
async def todays_prompt(user: dict = Depends(require_user)):
    date = today_iso()
    return DailyPrompt(date=date, text=daily_prompt(date))
