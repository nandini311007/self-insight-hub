"""Private journal entries — CRUD scoped to the signed-in user."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from lib.auth import require_user
from lib.dates import today_iso
from lib.db import db, prepare
from lib.timeutil import utcnow
from models.schemas import JournalEntry, JournalEntryCreate, JournalEntryUpdate

router = APIRouter(prefix="/journal", tags=["journal"])


@router.get("", response_model=list[JournalEntry])
async def list_entries(user: dict = Depends(require_user)):
    docs = await db.journal_entries.find({"user_id": user["id"]}).sort("created_at", -1).to_list(500)
    return [JournalEntry(**prepare(doc)) for doc in docs]


@router.post("", response_model=JournalEntry)
async def create_entry(input: JournalEntryCreate, user: dict = Depends(require_user)):
    now = utcnow()
    doc = input.model_dump()
    doc.update(
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "entry_date": input.entry_date or today_iso(),
            "created_at": now,
            "updated_at": now,
        }
    )
    await db.journal_entries.insert_one(doc)
    return JournalEntry(**prepare(doc))


@router.patch("/{entry_id}", response_model=JournalEntry)
async def update_entry(entry_id: str, input: JournalEntryUpdate, user: dict = Depends(require_user)):
    updates = input.model_dump(exclude_unset=True)
    updates["updated_at"] = utcnow()
    doc = await db.journal_entries.find_one_and_update(
        {"id": entry_id, "user_id": user["id"]},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return JournalEntry(**prepare(doc))


@router.delete("/{entry_id}")
async def delete_entry(entry_id: str, user: dict = Depends(require_user)):
    result = await db.journal_entries.delete_one({"id": entry_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"ok": True}
