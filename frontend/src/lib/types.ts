// Hand-written mirrors of the Pydantic models in backend/models/schemas.py — nothing infers
// across the HTTP boundary, so keep this file in sync with that one in the same edit.

export type Category = "daily_prompt" | "freeform" | "milestone" | "decision";
export type Mood = "joyful" | "calm" | "reflective" | "anxious" | "drained";
export type StressLevel = "low" | "moderate" | "high";

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  has_password: boolean;
  auth_provider: "password" | "google";
  reminder_enabled: boolean;
  reminder_hour: number;
  reminder_tz: string;
  created_at: string;
}

export interface WeeklyCheckIn {
  id: string;
  user_id: string;
  week_start: string;
  highlight: string;
  wins: string;
  struggles: string;
  lesson: string;
  intention: string;
  alignment: number;
  energy: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyCheckInWindow {
  week_start: string;
  week_end: string;
  is_sunday: boolean;
  completed: boolean;
  today: string;
}

export type TimelineKind = "entry" | "mood" | "checkin" | "decision" | "values" | "milestone";

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  date: string;
  at: string;
  title: string;
  body: string;
  meta: string;
  mood: Mood | null;
}

export interface TimelineOut {
  items: TimelineItem[];
}

export const TIMELINE_FILTERS: { value: "all" | TimelineKind; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "entry", label: "Entries" },
  { value: "mood", label: "Moods" },
  { value: "checkin", label: "Check-ins" },
  { value: "decision", label: "Decisions" },
  { value: "milestone", label: "Milestones" },
  { value: "values", label: "Values" },
];

export const REMINDER_HOURS: { value: string; label: string }[] = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${((h + 11) % 12) + 1}:00 ${h < 12 ? "am" : "pm"}`,
}));

export interface MeOut {
  user: User | null;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD, anchored server-side
  title: string;
  content: string;
  category: Category;
  mood: Mood | null;
  prompt_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface MoodLog {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD — one log per day, upserted
  mood: Mood;
  energy: number;
  note: string;
  created_at: string;
}

export interface ValuesResult {
  id: string;
  user_id: string;
  top_values: string[];
  definitions: Record<string, string>;
  alignment: number | null;
  created_at: string;
}

export interface DecisionOption {
  name: string;
  pros: string[];
  cons: string[];
  values_fit: number;
  energy_cost: number;
}

export interface Decision {
  id: string;
  user_id: string;
  title: string;
  dilemma: string;
  options: DecisionOption[];
  ten_ten_ten: Record<string, string>;
  gut_feeling: string;
  status: "open" | "decided";
  chosen_option: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityPost {
  id: string;
  pen_name: string;
  topic: string;
  title: string;
  body: string;
  hearts: number;
  hearted: boolean;
  created_at: string;
}

export interface CommunityPostHeart {
  id: string;
  hearts: number;
  hearted: boolean;
}

export interface Badge {
  key: string;
  label: string;
  description: string;
  earned: boolean;
}

export interface MoodPoint {
  date: string;
  score: number | null;
  mood: Mood | null;
}

export interface DashboardOut {
  streak: number;
  longest_streak: number;
  total_entries: number;
  total_moods: number;
  badges: Badge[];
  mood_series: MoodPoint[];
  recent_entries: JournalEntry[];
  values_top: string[];
}

export interface StreakOut {
  streak: number;
}

export interface DailyPrompt {
  date: string;
  text: string;
}

export interface AiSummary {
  summary: string;
  themes: string[];
  gentle_note: string;
}

export interface AiStress {
  stress_level: StressLevel;
  patterns: string[];
  suggestions: string[];
}

export interface AiPrompts {
  prompts: string[];
}

export interface AiDecisionMirror {
  feedback: string;
  risks: string[];
  confidence: string;
}

// --- UI-side twins of the backend constants (lib/prompts.py) ---
export const MOODS: Mood[] = ["joyful", "calm", "reflective", "anxious", "drained"];

export const MOOD_META: Record<Mood, { label: string; score: number; color: string }> = {
  joyful: { label: "Joyful", score: 5, color: "bg-[#D97706]" },
  calm: { label: "Calm", score: 4, color: "bg-[#3F7C5F]" },
  reflective: { label: "Reflective", score: 3, color: "bg-[#5E6278]" },
  anxious: { label: "Anxious", score: 2, color: "bg-[#B85D43]" },
  drained: { label: "Drained", score: 1, color: "bg-[#857262]" },
};

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "daily_prompt", label: "Daily prompt" },
  { value: "freeform", label: "Freeform" },
  { value: "milestone", label: "Milestone" },
  { value: "decision", label: "Decision" },
];

export const categoryLabel = (c: Category): string =>
  CATEGORIES.find((x) => x.value === c)?.label ?? c;

export const VALUES_POOL = [
  "Authenticity", "Adventure", "Ambition", "Calm", "Community", "Courage", "Creativity",
  "Curiosity", "Discipline", "Empathy", "Freedom", "Friendship", "Growth", "Health",
  "Independence", "Justice", "Learning", "Nature", "Purpose", "Security",
];

export const COMMUNITY_TOPICS = ["College life", "Career crossroads", "Personal hurdles", "Finding calm"];

export const PEN_NAMES = [
  "Curious Wanderer", "Quiet Thinker", "Night Owl", "Open Road", "Gentle Mind",
  "Brave Beginner", "Slow Bloomer", "Kind Stranger", "Second Draft", "North Star",
];

export const valueTestId = (v: string): string => `value-card-${v.toLowerCase().replace(/\s+/g, "-")}`;
