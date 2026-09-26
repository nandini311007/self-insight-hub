"""Gemini AI helper — strict-JSON responses."""

import json
import logging
import os
import re

from google import genai

logger = logging.getLogger(__name__)

MODEL_NAME = "gemini-2.5-flash"


async def ask_json(
    api_key: str,
    system_message: str,
    user_text: str,
    session_id: str,
) -> dict:
    """Generate a response and parse it as a JSON object."""

    client = genai.Client(api_key=api_key)

    prompt = f"""
{system_message}

IMPORTANT:
Return ONLY a valid JSON object.
Do not use markdown code fences.
Do not add any explanation before or after the JSON.

User input:
{user_text}
"""

    response = await client.aio.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
        },
    )

    raw = (response.text or "").strip()

    raw = re.sub(r"^```(?:json)?", "", raw).strip()
    raw = re.sub(r"```$", "", raw).strip()

    start = raw.find("{")
    end = raw.rfind("}")

    if start == -1 or end <= start:
        logger.error("AI reply was not JSON: %.500s", raw)
        raise ValueError("AI reply was not valid JSON")

    try:
        return json.loads(raw[start : end + 1])
    except json.JSONDecodeError as exc:
        logger.error("Could not parse AI JSON: %.500s", raw)
        raise ValueError("AI reply was not valid JSON") from exc
