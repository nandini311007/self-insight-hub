"""Shared app constants: the daily prompt pool, values pool, community topics, pen names."""

from datetime import datetime

DAILY_PROMPTS: list[str] = [
    "What tested your patience today, and how did you respond in the moment?",
    "Which small win from today deserves more credit than you gave it?",
    "What is one belief you held a year ago that you no longer hold?",
    "If your energy were weather, what would the forecast be today — and why?",
    "Who shaped your thinking this week, even if they never knew it?",
    "What did you avoid today, and what would facing it gently look like?",
    "When did you feel most like yourself today?",
    "What question have you been circling without answering?",
    "Which compliment from the past still sits warmly with you?",
    "What would you do differently if you knew no one was judging?",
    "What is one thing your body told you today that your mind ignored?",
    "Which conversation left you with something to chew on?",
    "What are you slowly getting better at, even if the progress is invisible?",
    "If today had a title, like a chapter, what would it be?",
    "What expectation of yourself felt heaviest today?",
    "Where did you choose comfort over growth — and was that the wrong call?",
    "What is something you understand about your family now that you didn't at ten?",
    "Which small ritual makes an ordinary day feel well-lived?",
    "What would 'enough' look like today?",
    "What thought kept returning this week, and what might it be protecting?",
    "Who would love to hear what happened to you today?",
    "What decision are you postponing, and what is the postponement costing?",
    "Which of your habits is quietly building the future you want?",
    "What did you learn about how you handle uncertainty?",
    "When was the last time you surprised yourself?",
    "What is one thing you can forgive yourself for today?",
    "Which environment brings out your best thinking — and how often do you enter it?",
    "What are you nostalgic for, and what does that longing point to?",
    "If a friend described your week back to you, what would they highlight?",
    "What is one boundary you're proud you held (or wish you had)?",
    "What dream have you outgrown, and what is replacing it?",
    "Where in your life are you settling for 'fine'?",
    "What kind of tired are you feeling today — body, mind, or heart?",
    "Which advice do you give others but struggle to take yourself?",
    "What made you lose track of time recently?",
    "What does your ideal ordinary Tuesday look like five years from now?",
    "Whose approval are you still auditioning for?",
    "What is one truth about yourself you're learning to accept?",
    "Which risk turned out to be worth it?",
    "What are you grateful for that you had no hand in creating?",
]

VALUES_POOL: list[str] = [
    "Authenticity",
    "Adventure",
    "Ambition",
    "Calm",
    "Community",
    "Courage",
    "Creativity",
    "Curiosity",
    "Discipline",
    "Empathy",
    "Freedom",
    "Friendship",
    "Growth",
    "Health",
    "Independence",
    "Justice",
    "Learning",
    "Nature",
    "Purpose",
    "Security",
]

COMMUNITY_TOPICS: list[str] = [
    "College life",
    "Career crossroads",
    "Personal hurdles",
    "Finding calm",
]

# Mood name → 1-5 valence score for the dashboard chart.
MOOD_SCORES: dict[str, int] = {
    "joyful": 5,
    "calm": 4,
    "reflective": 3,
    "anxious": 2,
    "drained": 1,
}

PEN_NAMES: list[str] = [
    "Curious Wanderer",
    "Quiet Thinker",
    "Night Owl",
    "Open Road",
    "Gentle Mind",
    "Brave Beginner",
    "Slow Bloomer",
    "Kind Stranger",
    "Second Draft",
    "North Star",
]


def daily_prompt(date_iso: str) -> str:
    """Deterministic prompt-of-the-day — the whole community reflects on the same question."""
    ordinal = datetime.strptime(date_iso, "%Y-%m-%d").date().toordinal()
    return DAILY_PROMPTS[ordinal % len(DAILY_PROMPTS)]
