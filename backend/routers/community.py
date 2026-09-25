"""Anonymous community board — pen names only, never emails or user ids."""

import random
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from lib.auth import require_user
from lib.db import db, prepare
from lib.prompts import PEN_NAMES
from lib.timeutil import utcnow
from models.schemas import CommunityPost, CommunityPostCreate, CommunityPostHeart

router = APIRouter(prefix="/community", tags=["community"])


def _post_out(doc: dict, user_id: str) -> CommunityPost:
    hearted_by = doc.get("hearted_by", [])
    return CommunityPost(
        id=doc["id"],
        pen_name=doc["pen_name"],
        topic=doc["topic"],
        title=doc["title"],
        body=doc["body"],
        hearts=len(hearted_by),
        hearted=user_id in hearted_by,
        created_at=doc["created_at"],
    )


@router.get("", response_model=list[CommunityPost])
async def list_posts(user: dict = Depends(require_user)):
    docs = await db.community_posts.find().sort("created_at", -1).to_list(100)
    return [_post_out(prepare(doc), user["id"]) for doc in docs]


@router.post("", response_model=CommunityPost)
async def create_post(input: CommunityPostCreate, user: dict = Depends(require_user)):
    pen_name = input.pen_name.strip() or f"{random.choice(PEN_NAMES)} {random.randint(10, 99)}"
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "pen_name": pen_name,
        "topic": input.topic.strip(),
        "title": input.title.strip(),
        "body": input.body.strip(),
        "hearted_by": [],
        "created_at": utcnow(),
    }
    await db.community_posts.insert_one(doc)
    return _post_out(prepare(doc), user["id"])


@router.post("/{post_id}/heart", response_model=CommunityPostHeart)
async def toggle_heart(post_id: str, user: dict = Depends(require_user)):
    doc = await db.community_posts.find_one({"id": post_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="Post not found")
    uid = user["id"]
    if uid in doc.get("hearted_by", []):
        update: dict = {"$pull": {"hearted_by": uid}}
        hearted = False
    else:
        update = {"$addToSet": {"hearted_by": uid}}
        hearted = True
    updated = await db.community_posts.find_one_and_update({"id": post_id}, update, return_document=ReturnDocument.AFTER)
    return CommunityPostHeart(id=post_id, hearts=len(updated.get("hearted_by", [])), hearted=hearted)
