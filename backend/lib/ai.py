"""OpenAI helper — strict-JSON answers."""

import json
import logging
import re

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

MODEL_NAME = "gpt-5.4"


async def ask_json(
    api_key: str,
    system_message: str,
    user_text: str,
    session_id: str,
) -> dict:
    """Generate a JSON response using OpenAI."""

    client = AsyncOpenAI(api_key=api_key)

    response = await client.responses.create(
        model=MODEL_NAME,
        instructions=system_message,
        input=user_text,
    )

    raw = response.output_text.strip()

    # Tolerate markdown JSON code fences
    raw = re.sub(r"^```(?:json)?", "", raw).strip()
    raw = re.sub(r"```$", "", raw).strip()

    start, end = raw.find("{"), raw.rfind("}")

    if start == -1 or end <= start:
        logger.error("AI reply was not JSON: %.200s", raw)
        raise ValueError("AI reply was not valid JSON")

    return json.loads(raw[start : end + 1])
