"""Time helpers. The pod clock is UTC — build datetimes here, never in the browser."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Aware UTC now — store this so Pydantic serialises the offset and `new Date()` parses it."""
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    """Motor hands back naive UTC datetimes — normalise before Pydantic serialises them."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)
