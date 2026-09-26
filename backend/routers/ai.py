"""AI reflection assistant — Emergent LLM (gpt-5.4) with strict JSON replies."""

import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from lib.ai import ask_json
from lib.auth import require_user
from lib.db import db
from models.schemas import (
    AiDecisionMirror,
    AiDecisionMirrorIn,
    AiPrompts,
    AiPromptsIn,
    AiStress,
    AiStressIn,
    AiSummarizeIn,
    AiSummary,
)

router = APIRouter(prefix="/ai", tags=["ai"])

AI_UNAVAILABLE = "The AI assistant is taking a breath — please try again in a moment."


def _key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise HTTPException(
            status_code=503,
            detail="AI is not configured yet — add GEMINI_API_KEY to the backend environment",
        )
    return key


@router.post("/summarize", response_model=AiSummary)
async def summarize(input: AiSummarizeIn, user: dict = Depends(require_user)):
    system = (
        "You are the Self Insight Hub reflection assistant: warm, honest, never clinical. "
        "Analyse the user's private journal entry and reply with ONLY a JSON object: "
        '{"summary": "a compassionate 2-3 sentence summary in second person", '
        '"themes": ["3-5 short theme labels"], '
        '"gentle_note": "one encouraging sentence addressed to the user"}'
    )
    try:
        data = await ask_json(_key(), system, input.content, f"{user['id']}-summarize")
        return AiSummary(**data)
    except (ValueError, ValidationError):
        raise HTTPException(status_code=502, detail=AI_UNAVAILABLE)


@router.post("/stress-patterns", response_model=AiStress)
async def stress_patterns(input: AiStressIn, user: dict = Depends(require_user)):
    uid = user["id"]
    entries = await db.journal_entries.find({"user_id": uid}).sort("created_at", -1).to_list(8)
    moods = await db.mood_logs.find({"user_id": uid}).sort("date", -1).to_list(14)
    context = "Recent journal entries:\n" + "\n---\n".join(e["content"][:1200] for e in entries) if entries else "No journal entries yet."
    mood_line = "Recent moods: " + (", ".join(f"{m['date']}: {m['mood']} (energy {m['energy']}/10)" for m in moods) or "none logged")
    if input.content:
        context += "\n\nFocus passage from the user:\n" + input.content[:2000]
    system = (
        "You are the Self Insight Hub AI that notices stress and confusion patterns kindly and without judgement. "
        "Reply with ONLY a JSON object: "
        '{"stress_level": "low" or "moderate" or "high" (lowercase), '
        '"patterns": ["2-4 specific patterns you noticed in their thinking or mood"], '
        '"suggestions": ["2-4 small, concrete next steps or mindfulness micro-actions"]}'
    )
    try:
        data = await ask_json(_key(), system, f"{context}\n\n{mood_line}", f"{uid}-stress")
        data["stress_level"] = str(data.get("stress_level", "moderate")).lower()
        return AiStress(**data)
    except (ValueError, ValidationError):
        raise HTTPException(status_code=502, detail=AI_UNAVAILABLE)


@router.post("/prompt-suggestions", response_model=AiPrompts)
async def prompt_suggestions(input: AiPromptsIn, user: dict = Depends(require_user)):
    parts = []
    if input.content:
        parts.append("They just wrote this reflection:\n" + input.content[:2000])
    if input.values:
        parts.append("Their core values: " + ", ".join(input.values[:5]))
    parts.append("Offer 3 fresh reflection questions that fit them right now — specific, open, never yes/no.")
    system = (
        "You are the Self Insight Hub prompt designer. Reply with ONLY a JSON object: "
        '{"prompts": ["exactly 3 reflection questions as strings"]}'
    )
    try:
        data = await ask_json(_key(), system, "\n\n".join(parts), f"{user['id']}-prompts")
        prompts = [str(p) for p in data.get("prompts", [])][:3]
        if len(prompts) < 3:
            raise ValueError("fewer than 3 prompts")
        return AiPrompts(prompts=prompts)
    except (ValueError, ValidationError):
        raise HTTPException(status_code=502, detail=AI_UNAVAILABLE)


@router.post("/decision-mirror", response_model=AiDecisionMirror)
async def decision_mirror(input: AiDecisionMirrorIn, user: dict = Depends(require_user)):
    options_text = "\n".join(
        f"- {o.name}: pros {', '.join(o.pros) or 'none listed'}; cons {', '.join(o.cons) or 'none listed'}; "
        f"values fit {o.values_fit}/5; energy cost {o.energy_cost}/5"
        for o in input.options
    )
    user_text = f"Decision: {input.title}\nDilemma: {input.dilemma}\nOptions:\n{options_text}"
    system = (
        "You are the Self Insight Hub decision mirror: balanced, specific, never making the choice for them. "
        "Reply with ONLY a JSON object: "
        '{"feedback": "3-5 sentences weighing the options and naming hidden assumptions", '
        '"risks": ["2-3 concrete risks or worst-case fallbacks to check"], '
        '"confidence": "one short phrase about how settled this decision looks"}'
    )
    try:
        data = await ask_json(_key(), system, user_text, f"{user['id']}-mirror")
        return AiDecisionMirror(**data)
    except (ValueError, ValidationError):
        raise HTTPException(status_code=502, detail=AI_UNAVAILABLE)
