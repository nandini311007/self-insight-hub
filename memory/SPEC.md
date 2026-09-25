# Self Insight Hub — Living Spec

A calm self-reflection platform (warm editorial journal aesthetic: Lora serif headings, DM Sans body,
parchment surfaces, terracotta #A65B32 accent). Public URL: https://self-insight-hub-4.preview.emergentagent.com

## What the app does (v1 scope, per user's choices)
- **Auth**: simple email+password login/signup; private per-user journal. httpOnly cookie sessions
  (`sih_session`, SameSite=None+Secure so the iframed preview keeps the session). `/api/auth/me` returns
  `{"user": null}` when signed out (never a 401 — keeps the static preview console clean).
- **Daily prompts**: deterministic prompt-of-the-day (server-anchored date, same for all users), write
  reflections against it from the dashboard.
- **Journal**: private CRUD entries with category (daily_prompt/freeform/milestone/decision), optional mood
  tag, search + filter tabs, word count, two-step delete.
- **Mood tracker**: one upserted log per day (5 mood stones + energy 1-10 + note), 14-day recharts area
  chart (server-anchored "today" via /api/prompts/daily), history with mood filter.
- **Values discovery**: pick up to 5 ranked values from a 20-value pool, optional definitions, weekly
  alignment 1-10, saved result; AI prompts generated from the chosen values.
- **Decision framework**: dilemma framing, 2-4 options with pros/cons + values fit + energy cost, 10/10/10
  exercise, gut check; mark decided; AI decision mirror.
- **Progress dashboard**: streak (entries ∪ mood dates, consecutive days ending today-or-yesterday),
  longest streak, totals, 8 achievement badges, 14-day mood series, recent reflections, AI stress patterns.
- **AI assistant** (Emergent LLM universal key, openai gpt-5.4, JSON-only replies via streamed+accumulated
  chat): /api/ai/summarize, /api/ai/stress-patterns, /api/ai/prompt-suggestions, /api/ai/decision-mirror.
  Key lives in backend/.env as EMERGENT_LLM_KEY.
- **Community**: anonymous board (pen names only, user ids never exposed in responses beyond heart toggle),
  4 topics, resonate (heart) toggle per user.
- Every page degrades gracefully when the backend is unreachable: shell renders, data regions show
  skeleton → friendly error + retry.

## Data model (Mongo, string uuid4 ids; collections)
users(email unique, password_hash pbkdf2), sessions(token unique, expires_at TTL),
journal_entries(user_id, entry_date, title, content, category, mood, prompt_text, timestamps),
mood_logs(user_id+date unique, mood, energy, note), values_results(user_id, top_values, definitions,
alignment), decisions(user_id, title, dilemma, options[], ten_ten_ten, gut_feeling, status,
chosen_option), community_posts(user_id, pen_name, topic, title, body, hearted_by[]).
Indexes defined in backend/lib/db.py INDEXES, applied by ensure_indexes() at startup.

## Key flows
- Login (or demo button) → beginSession() clears react-query cache → dashboard.
- Dashboard: daily prompt write → POST /journal (category daily_prompt); mood stones → POST /mood (upsert).
- Streak pill in the glass header reads GET /api/dashboard/streak.
- All routes on api_router under /api; routers in backend/routers/{auth,journal,mood,values,decisions,
  community,dashboard,prompts,ai}.py; Pydantic models mirrored by hand in frontend/src/lib/types.ts.

## Seed
`cd /app/backend && python seed.py` — idempotent, refreshes demo data each run (dates relative to today).
Demo account + seeded journal/moods/values/decision/community posts.

## Credentials
See memory/test_credentials.md — demo@insighthub.app / demo1234.

## Phased next (user explicitly deferred)
Weekly life check-in, strength/interest mapping, reflection reminders, mind dump / priority sorting /
life compass clarity tools, career exploration modules, reflection challenges, mentor insights.
