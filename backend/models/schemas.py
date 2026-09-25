"""Pydantic v2 models — the Python half of the Pydantic ↔ TS boundary.

Every model here has a hand-written TS interface (or constant) in
frontend/src/lib/types.ts — keep the two files in sync in the same edit.
"""

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


def _uuid() -> str:
    return str(uuid.uuid4())


Category = Literal["daily_prompt", "freeform", "milestone", "decision"]
Mood = Literal["joyful", "calm", "reflective", "anxious", "drained"]
StressLevel = Literal["low", "moderate", "high"]


# --- auth ---
class UserOut(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(default="", max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class MeOut(BaseModel):
    # 200 with user=null when signed out — keeps the console clean on the static preview.
    user: Optional[UserOut] = None


# --- journal ---
class JournalEntry(BaseModel):
    id: str = Field(default_factory=_uuid)
    user_id: str
    entry_date: str  # YYYY-MM-DD, anchored server-side
    title: str
    content: str
    category: Category = "freeform"
    mood: Optional[Mood] = None
    prompt_text: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class JournalEntryCreate(BaseModel):
    title: str = Field(default="Untitled reflection", max_length=140)
    content: str = Field(min_length=1, max_length=20_000)
    category: Category = "freeform"
    mood: Optional[Mood] = None
    entry_date: Optional[str] = None  # defaults to today (UTC) server-side


class JournalEntryUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=140)
    content: Optional[str] = Field(default=None, min_length=1, max_length=20_000)
    category: Optional[Category] = None
    mood: Optional[Mood] = None


# --- mood ---
class MoodLog(BaseModel):
    id: str = Field(default_factory=_uuid)
    user_id: str
    date: str  # YYYY-MM-DD — one log per day, upserted
    mood: Mood
    energy: int = Field(ge=1, le=10)
    note: str = Field(default="", max_length=500)
    created_at: datetime


class MoodLogCreate(BaseModel):
    mood: Mood
    energy: int = Field(default=5, ge=1, le=10)
    note: str = Field(default="", max_length=500)
    date: Optional[str] = None


# --- values ---
class ValuesResult(BaseModel):
    id: str = Field(default_factory=_uuid)
    user_id: str
    top_values: list[str]
    definitions: dict[str, str] = {}
    alignment: Optional[int] = None
    created_at: datetime


class ValuesSave(BaseModel):
    top_values: list[str] = Field(min_length=1, max_length=6)
    definitions: dict[str, str] = {}
    alignment: Optional[int] = Field(default=None, ge=1, le=10)


# --- decisions ---
class DecisionOption(BaseModel):
    name: str = Field(max_length=120)
    pros: list[str] = []
    cons: list[str] = []
    values_fit: int = Field(default=3, ge=1, le=5)
    energy_cost: int = Field(default=3, ge=1, le=5)


class Decision(BaseModel):
    id: str = Field(default_factory=_uuid)
    user_id: str
    title: str
    dilemma: str
    options: list[DecisionOption]
    ten_ten_ten: dict[str, str] = {}
    gut_feeling: str = ""
    status: Literal["open", "decided"] = "open"
    chosen_option: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DecisionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    dilemma: str = Field(min_length=1, max_length=5000)
    options: list[DecisionOption] = Field(min_length=2, max_length=4)
    ten_ten_ten: dict[str, str] = {}
    gut_feeling: str = Field(default="", max_length=2000)


class DecisionUpdate(BaseModel):
    status: Optional[Literal["open", "decided"]] = None
    chosen_option: Optional[str] = None


# --- community ---
class CommunityPost(BaseModel):
    id: str = Field(default_factory=_uuid)
    pen_name: str
    topic: str
    title: str
    body: str
    hearts: int = 0
    hearted: bool = False
    created_at: datetime


class CommunityPostCreate(BaseModel):
    pen_name: str = Field(default="", max_length=60)
    topic: str = Field(max_length=60)
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=5000)


class CommunityPostHeart(BaseModel):
    id: str
    hearts: int
    hearted: bool


# --- prompts / dashboard ---
class DailyPrompt(BaseModel):
    date: str
    text: str


class Badge(BaseModel):
    key: str
    label: str
    description: str
    earned: bool


class MoodPoint(BaseModel):
    date: str
    score: Optional[int] = None
    mood: Optional[Mood] = None


class DashboardOut(BaseModel):
    streak: int
    longest_streak: int
    total_entries: int
    total_moods: int
    badges: list[Badge]
    mood_series: list[MoodPoint]
    recent_entries: list[JournalEntry]
    values_top: list[str] = []


class StreakOut(BaseModel):
    streak: int


# --- AI assistant ---
class AiSummarizeIn(BaseModel):
    content: str = Field(min_length=1, max_length=20_000)


class AiSummary(BaseModel):
    summary: str
    themes: list[str] = []
    gentle_note: str = ""


class AiStressIn(BaseModel):
    content: Optional[str] = None


class AiStress(BaseModel):
    stress_level: StressLevel
    patterns: list[str] = []
    suggestions: list[str] = []


class AiPromptsIn(BaseModel):
    content: Optional[str] = None
    values: list[str] = Field(default_factory=list, max_length=6)


class AiPrompts(BaseModel):
    prompts: list[str]


class AiDecisionMirrorIn(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    dilemma: str = Field(min_length=1, max_length=5000)
    options: list[DecisionOption] = Field(min_length=1, max_length=4)


class AiDecisionMirror(BaseModel):
    feedback: str
    risks: list[str] = []
    confidence: str = ""
