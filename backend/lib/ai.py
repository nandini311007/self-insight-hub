"""Emergent LLM helper — strict-JSON answers collected from the streaming chat API."""

import json
import logging
import re

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage

logger = logging.getLogger(__name__)

MODEL_PROVIDER = "openai"
MODEL_NAME = "gpt-5.4"


async def ask_json(api_key: str, system_message: str, user_text: str, session_id: str) -> dict:
    """Stream a completion, accumulate it, and parse the reply as a JSON object.

    Raises ValueError when no JSON object can be recovered — callers map that to a 502.
    """
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_message,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    parts: list[str] = []
    async for event in chat.stream_message(UserMessage(text=user_text)):
        if isinstance(event, TextDelta):
            parts.append(event.content)
        elif isinstance(event, StreamDone):
            break

    raw = "".join(parts).strip()
    raw = re.sub(r"^```(?:json)?", "", raw).strip()  # tolerate a code fence
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end <= start:
        logger.error("AI reply was not JSON: %.200s", raw)
        raise ValueError("AI reply was not valid JSON")
    return json.loads(raw[start : end + 1])
