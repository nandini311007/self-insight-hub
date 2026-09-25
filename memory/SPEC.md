# Self Insight Hub — Living Spec

A calm self-reflection platform (warm editorial journal aesthetic: Lora serif headings, DM Sans body,
parchment surfaces, terracotta #A65B32 accent). Public URL: https://self-insight-hub-4.preview.emergentagent.com

## What the app does (v1 scope, per user's choices)
- **Auth**: email+password login/signup **and Google sign-in** (Emergent Auth). httpOnly cookie
  sessions (`sih_session`, SameSite=None+Secure). `/api/auth/me` returns `{"user": null}` when signed
  out (200, by design). Google flow: frontend redirects to `auth.emergentagent.com` with
  `window.location.origin + "/"` (NEVER hardcoded), lands back on `/#session_id=...`; `App.tsx`
  detects the hash during render and mounts `AuthCallback`, which POSTs to
  `/api/auth/google/session`. That endpoint exchanges the id server-side, then creates OUR session.
  Google sign-in with an email that already exists **links to that account** instead of duplicating.
  Google-only users have `password_hash: ""` and can SET a password without supplying a current one.
- **Account settings** (`/settings`, reached from the profile menu): change display name, change email
  (requires current password when the account has one), change/set password, reminder preferences,
  ambient-sound toggle.
- **Reflection reminders**: opt-in daily email with today's prompt + streak. User picks the hour and
  their browser timezone is stored. Delivery is a platform cron (`.emergent/crons.yml`,
  `daily-reminders`, hourly `0 * * * *`) hitting `POST /api/cron/reminders`, which authenticates a
  `Bearer WEBHOOK_CRON_SECRET`, acks 2xx immediately and backgrounds the send. The sweep emails only
  users whose local hour matches now, and `last_reminder_date` makes it idempotent per local day.
  Email goes through Emergent's managed Resend proxy (`lib/email.py`, server-side template only,
  `_assert_safe_email` gate on every send). `POST /api/auth/reminders/test` sends to the signed-in
  user's own address.
- **Weekly check-in** (`/checkin`): guided Sunday review — 5 questions (highlight, wins, struggles,
  lesson, intention) plus alignment and energy 1-10. One upserted record per ISO week (Monday key);
  `/api/checkins/window` returns the week being reviewed and whether it's done.
- **Growth timeline** (`/timeline`): one chronological feed merging journal entries, moods, weekly
  check-ins, decisions, values and milestones; grouped by month, filterable by type.
- **Meditative ambience**: optional Web Audio-synthesized drone + filtered brown noise
  (`frontend/src/lib/ambient.ts`) — no audio assets. Header toggle + Settings toggle, preference in
  localStorage, only ever started by a user gesture, fades in/out to avoid clicks.
- **Daily prompts**: deterministic prompt-of-the-day (server-anchored date, same for all users).
- **Journal**: private CRUD entries with category, optional mood tag, search + filter tabs.
- **Mood tracker**: one upserted log per day, 14-day recharts area chart, history with mood filter.
- **Values discovery**: pick up to 5 ranked values from a 20-value pool, definitions, alignment score.
- **Decision framework**: dilemma, 2-4 weighted options, 10/10/10, gut check, mark decided.
- **Progress dashboard**: streak, longest streak, totals, 8 badges, 14-day mood series, recent entries.
- **AI assistant** (Emergent LLM key, openai gpt-5.4, JSON-only replies): `/api/ai/summarize`,
  `/api/ai/stress-patterns`, `/api/ai/prompt-suggestions`, `/api/ai/decision-mirror`.
- **Community**: anonymous board (pen names only), 4 topics, per-user heart toggle.
- Every page degrades gracefully when the backend is unreachable.

## Known limitation
The seeded demo address `demo@insighthub.app` is a **fake domain**, so the email provider blocks it as
undeliverable (`400` with a clear message telling the user to set a real inbox in Settings). Demo
reminders therefore ship switched OFF. Real reminder delivery is verified against a deliverable
address — see the cron notes above.

## Data model (Mongo, string uuid4 ids; collections)
users(email unique, password_hash pbkdf2), sessions(token unique, expires_at TTL),
journal_entries(user_id, entry_date, title, content, category, mood, prompt_text, timestamps),
mood_logs(user_id+date unique, mood, energy, note), values_results(user_id, top_values, definitions,
alignment), decisions(user_id, title, dilemma, options[], ten_ten_ten, gut_feeling, status,
chosen_option), community_posts(user_id, pen_name, topic, title, body, hearted_by[]),
weekly_checkins(user_id+week_start unique, highlight, wins, struggles, lesson, intention,
alignment, energy).
`users` also carries: picture, auth_provider ("password"|"google"), reminder_enabled,
reminder_hour, reminder_tz, last_reminder_date, last_reminder_at.
Indexes defined in backend/lib/db.py INDEXES, applied by ensure_indexes() at startup.

## Env (backend/.env)
MONGO_URL, DB_NAME, CORS_ORIGINS, APP_URL, EMERGENT_LLM_KEY, EMERGENT_EMAIL_KEY,
EMAIL_FROM_NAME, WEBHOOK_CRON_SECRET.

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
End-of-month life reflection, strength/interest mapping, mind dump / priority sorting / life compass
clarity tools, career exploration modules, reflection challenges, mentor insights, progress levels.

## Google sign-in testing
See `/app/auth_testing.md`. The Google flow cannot be completed in automated tests (real Google
credentials); verify the button exists and that `/api/auth/google/session` rejects a bogus id with 401.
