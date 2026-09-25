"""Idempotent seed: demo account, a lively fortnight of reflections and moods, community posts.

Run:  cd /app/backend && python seed.py
Every run refreshes the demo user's data so dates stay relative to today.
"""

import uuid
from datetime import datetime, timedelta

from lib.auth import hash_password
from lib.db import client, db, ensure_indexes
from lib.dates import today_iso
from lib.timeutil import utcnow

DEMO_EMAIL = "demo@insighthub.app"
DEMO_PASSWORD = "demo1234"
BOT_IDS = ["seed-bot-1", "seed-bot-2", "seed-bot-3", "seed-bot-4"]


def day(offset: int) -> str:
    base = datetime.strptime(today_iso(), "%Y-%m-%d")
    return (base - timedelta(days=offset)).strftime("%Y-%m-%d")


def ago(offset: int, hours: float = 2.0):
    return utcnow() - timedelta(days=offset, hours=hours)


JOURNAL_SEEDS = [
    (0, "daily_prompt", "Held my nerve in the seminar", "The prompt asked what tested me lately — my presentation almost broke me, but I finished it, and the questions afterwards felt like a conversation instead of an attack. Noted the shaky start so future me remembers courage is a practice.", "anxious", 7),
    (1, "freeform", "The 2am clarity list", "Woke up with a complete answer to the internship question. Wrote it down before it evaporated: it is not about prestige, it is about who I want to sit next to while learning. That reframed everything.", "calm", 6),
    (2, "milestone", "First 5km without stopping", "Six weeks of telling myself I'm not a runner, and today the watch said 5km, no walk breaks. The legs complained; the brain was quiet for an hour afterwards. Keep this feeling on the shelf for hard days.", "joyful", 8),
    (3, "daily_prompt", "The postponement cost", "I have been circling the email to Professor Rao for nine days. Writing the draft took eleven minutes. The gap between dread and done was eleven minutes — that ratio keeps embarrassing me into action.", "reflective", 5),
    (4, "freeform", "Home smells different in autumn", "Small note to self: call amma on Sundays, not just birthdays. The nostalgia from the prompt pool hit sideways — longing is information, and it was pointing at family, not the past.", "calm", 7),
    (6, "decision", "Internship vs café job — the ledger", "Laid both options out with the framework: research internship wins on values fit and growth; the café wins on sleep and friends. Gut says internship, and the 10/10/10 exercise agreed in every column. Marking it decided.", "reflective", 6),
    (7, "daily_prompt", "What 'enough' looked like", "Enough was: two focused hours on the thesis, a slow lunch, one chapter read for pleasure. I hit two of three and the third wasn't missed as much as I predicted. 'Enough' is a design problem, not a discipline one.", "joyful", 7),
    (9, "freeform", "Feedback that stung productively", "Teammate said I dominate planning calls. First reaction was defensive; second reaction (after a walk) was 'partly true'. Trying one meeting where I only ask questions. Uncomfortable and clarifying.", "anxious", 5),
    (11, "daily_prompt", "Weather report: internal", "If my energy were weather: morning fog, clear by afternoon. The fog was the 6am alarm and the doom-scroll; the clearing was a friend's unexpected call. Protect the afternoons; soften the mornings.", "drained", 4),
]

MOOD_SEEDS = [
    (0, "anxious", 7, "Presentation day nerves, steadied by preparation."),
    (1, "calm", 6, "Slow morning, the good kind of quiet."),
    (2, "joyful", 8, "Runner's high is real, apparently."),
    (3, "reflective", 5, "Avoiding one email, observing myself avoid it."),
    (4, "calm", 7, "Called home; the evening felt lighter."),
    (5, "joyful", 8, "Study group actually made me laugh out loud."),
    (6, "reflective", 6, "Big decision day — oddly serene after writing it out."),
    (7, "joyful", 7, "Enough day. It worked."),
    (8, "drained", 4, "Slept badly, carried the fog all day."),
    (9, "anxious", 5, "Feedback conversation, then a long walk."),
    (10, "calm", 6, "Library corner seat, rain outside, thesis moving."),
    (11, "drained", 4, "Morning fog day. Afternoon saved it."),
    (12, "reflective", 6, "Reread old entries — past me had good advice."),
    (13, "calm", 7, "Cooked instead of ordering in. Small victory."),
]

COMMUNITY_SEEDS = [
    ("seed-bot-1", "Quiet Thinker", "College life", "The semester I stopped performing busy", "I used to answer 'so busy' whenever anyone asked how I was — mostly to seem serious about my degree. This month I tracked my hours honestly and found I had 20 free ones a week. Scary and liberating. Now I spend three of them on things that are just mine."),
    ("seed-bot-2", "Open Road", "Career crossroads", "Chose the smaller internship and I keep double-checking", "Turned down a famous-name offer for a tiny studio where I'd actually build things. Some days I'm sure, some days I check their LinkedIn at 1am. Writing the 10/10/10 exercise helped: in ten months I want to show a portfolio, not a brand name."),
    ("seed-bot-3", "Gentle Mind", "Finding calm", "Five minutes of nothing changed my mornings", "I started sitting on my balcony with my phone still inside — five minutes, just weather and sounds. It sounds fake when I type it. But the rushed, late, snappy version of me has mostly disappeared from the first hour of the day."),
    ("seed-bot-4", "Brave Beginner", "Personal hurdles", "Told my friends I'm struggling, and they didn't flinch", "Kept my internship rejections quiet because everyone around me seemed to be winning. Finally told two friends over chai. They didn't fix anything — they just didn't flinch, and one said 'same, honestly'. The load didn't shrink; it got shared."),
    ("seed-bot-1", "Quiet Thinker", "College life", "Advice to my first-year self, pinned here on purpose", "Go to the weird elective. Eat with people, not at your desk. Your marks will not be the interesting thing about you. And when the group project explodes — it's practice for every workplace ever, not a referendum on you."),
    ("seed-bot-2", "North Star", "Career crossroads", "The spreadsheet said no, the values test said yes", "Ran both job offers through the values compass here. Security scored the safe role higher, growth scored the startup. Seeing my own weights on paper made the choice obvious — and mine, not my parents'."),
    ("seed-bot-3", "Kind Stranger", "Finding calm", "A small board note: it's allowed to be a Tuesday", "Nothing dramatic today. Skipped the gym, read instead, went to bed early. Posting so someone else gives themselves the same permission. Rest is part of the plan, not a detour from it."),
]

VALUES_SEED = {
    "top_values": ["Curiosity", "Courage", "Calm", "Growth", "Connection"],
    "definitions": {
        "Curiosity": "Following questions past the point where it's convenient.",
        "Courage": "Doing the scary, honest thing while the hands are still shaking.",
        "Calm": "Protecting an unhurried hour, even in exam season.",
    },
    "alignment": 7,
}

DECISION_SEED = {
    "title": "Summer research internship or the café job?",
    "dilemma": "The research internship pays little and eats the whole summer; the café job pays rent and keeps evenings free. One builds toward grad school, the other keeps my savings and friendships intact.",
    "options": [
        {"name": "Research internship", "pros": ["Direct path to grad school references", "Daily practice doing real research"], "cons": ["Barely covers rent", "Long days, less time with friends"], "values_fit": 5, "energy_cost": 5},
        {"name": "Café job", "pros": ["Financial breathing room", "Evenings and weekends stay mine"], "cons": ["Research skills stall another year", "Rhythm gets monotonous by August"], "values_fit": 2, "energy_cost": 3},
    ],
    "ten_ten_ten": {
        "minutes": "Both feel fine — no panic either way.",
        "months": "Internship: a portfolio chapter I'll reference for years. Café: money saved, same question reappearing.",
        "years": "The internship version of me knows how to ask better questions; that's the life I want.",
    },
    "gut_feeling": "Leans internship, with a lump of money anxiety.",
}


async def main() -> None:
    demo = await db.users.find_one({"email": DEMO_EMAIL})
    if demo:
        demo_id = demo["id"]
        # Refresh every run so the demo's dates stay relative to today.
        await db.journal_entries.delete_many({"user_id": demo_id})
        await db.mood_logs.delete_many({"user_id": demo_id})
        await db.values_results.delete_many({"user_id": demo_id})
        await db.decisions.delete_many({"user_id": demo_id})
    else:
        demo_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": demo_id,
            "email": DEMO_EMAIL,
            "name": "Demo",
            "password_hash": hash_password(DEMO_PASSWORD),
            "created_at": ago(30),
        })

    now = utcnow()
    for offset, category, title, content, mood, energy in JOURNAL_SEEDS:
        await db.journal_entries.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": demo_id,
            "entry_date": day(offset),
            "title": title,
            "content": content,
            "category": category,
            "mood": mood,
            "prompt_text": None,
            "created_at": ago(offset),
            "updated_at": ago(offset),
        })

    for offset, mood, energy, note in MOOD_SEEDS:
        await db.mood_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": demo_id,
            "date": day(offset),
            "mood": mood,
            "energy": energy,
            "note": note,
            "created_at": ago(offset),
        })

    await db.values_results.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": demo_id,
        **VALUES_SEED,
        "created_at": ago(5),
    })

    await db.decisions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": demo_id,
        **DECISION_SEED,
        "status": "decided",
        "chosen_option": "Research internship",
        "created_at": ago(8),
        "updated_at": ago(6),
    })

    await db.community_posts.delete_many({"user_id": {"$in": BOT_IDS}})
    for i, (bot_id, pen_name, topic, title, body) in enumerate(COMMUNITY_SEEDS):
        await db.community_posts.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": bot_id,
            "pen_name": pen_name,
            "topic": topic,
            "title": title,
            "body": body,
            "hearted_by": [f"seed-heart-{n}" for n in range((i * 3) % 8)],
            "created_at": ago(i),
        })

    await ensure_indexes()
    print(f"Seeded demo account: {DEMO_EMAIL} / {DEMO_PASSWORD}")
    print(f"Journal entries: {await db.journal_entries.count_documents({'user_id': demo_id})}, "
          f"mood logs: {await db.mood_logs.count_documents({'user_id': demo_id})}, "
          f"community posts: {await db.community_posts.count_documents({})}")
    client.close()


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
