"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

from lib.timeutil import as_utc

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [IndexModel([("email", ASCENDING)], name="email", unique=True)],
    "sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="expires_at_ttl", expireAfterSeconds=0),
    ],
    "journal_entries": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
        IndexModel([("user_id", ASCENDING), ("entry_date", DESCENDING)], name="user_entry_date"),
    ],
    "mood_logs": [
        IndexModel([("user_id", ASCENDING), ("date", ASCENDING)], name="user_date", unique=True),
    ],
    "values_results": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
    ],
    "decisions": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
    ],
    "community_posts": [
        IndexModel([("created_at", DESCENDING)], name="created_desc"),
        IndexModel([("user_id", ASCENDING)], name="user"),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


_DT_FIELDS = ("created_at", "updated_at", "expires_at", "timestamp")


def prepare(doc: dict | None) -> dict | None:
    """Shape a Mongo document for Pydantic: drop `_id`, make naive UTC datetimes aware."""
    if doc is None:
        return None
    out = {k: v for k, v in doc.items() if k != "_id"}
    for key in _DT_FIELDS:
        value = out.get(key)
        if isinstance(value, datetime):
            out[key] = as_utc(value)
    return out
