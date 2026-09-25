import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Medal, PenLine, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { fmtDate, fmtDateLong, wordCount } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import {
  categoryLabel,
  MOOD_META,
  type AiStress,
  type DashboardOut,
  type DailyPrompt,
  type JournalEntry,
  type Mood,
  type MoodLog,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import MoodStones from "@/components/MoodStones";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Dashboard() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet<DashboardOut>("/dashboard"), retry: false });
  const prompt = useQuery({ queryKey: ["dailyPrompt"], queryFn: () => apiGet<DailyPrompt>("/prompts/daily"), retry: false });

  const [reflection, setReflection] = useState("");
  const [mood, setMood] = useState<Mood | null>(null);
  const [energy, setEnergy] = useState(5);
  const [note, setNote] = useState("");

  const afterSave = () => {
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["streak"] });
  };

  const saveReflection = useMutation({
    mutationFn: () =>
      apiPost<JournalEntry>("/journal", {
        title: `Daily reflection — ${prompt.data ? fmtDate(prompt.data.date) : "today"}`,
        content: reflection.trim(),
        category: "daily_prompt",
        prompt_text: prompt.data?.text ?? null,
        entry_date: prompt.data?.date ?? undefined,
      }),
    onSuccess: () => {
      toast.success("Reflection saved to your sanctuary");
      setReflection("");
      void qc.invalidateQueries({ queryKey: ["journal"] });
      afterSave();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const saveMood = useMutation({
    mutationFn: () => apiPost<MoodLog>("/mood", { mood: mood as Mood, energy, note }),
    onSuccess: () => {
      toast.success("Mood logged — small notes, big patterns");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["mood"] });
      afterSave();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const stress = useMutation({
    mutationFn: () => apiPost<AiStress>("/ai/stress-patterns", {}),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (me?.user?.name ?? "").split(" ")[0];
  const writtenToday =
    !!prompt.data && !!dash.data?.recent_entries?.some((e) => e.category === "daily_prompt" && e.entry_date === prompt.data.date);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground" data-testid="dashboard-date">
            {prompt.data ? fmtDateLong(prompt.data.date) : "\u00a0"}
          </p>
          <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight sm:text-4xl" data-testid="dashboard-greeting">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <Link to="/journal" className={buttonVariants({ variant: "outline" })} data-testid="open-journal-cta">
          <PenLine className="size-4" /> Open journal
        </Link>
      </header>

      {dash.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-3" data-testid="dashboard-skeleton">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-56 animate-pulse rounded-2xl bg-muted" />
            <div className="h-44 animate-pulse rounded-2xl bg-muted" />
          </div>
          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-2xl bg-muted" />
            <div className="h-64 animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      ) : dash.isError || !dash.data ? (
        <Card data-testid="dashboard-error">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="text-sm text-muted-foreground">Could not reach your sanctuary just now — the rest of the page still works.</p>
            <Button variant="outline" size="sm" onClick={() => void dash.refetch()} data-testid="dashboard-retry-button">
              <RefreshCw className="size-4" /> Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Daily prompt */}
            <Card data-testid="daily-prompt-card">
              <CardHeader>
                <CardDescription className="text-xs font-medium uppercase tracking-[0.16em]">Today's reflection question</CardDescription>
                <CardTitle className="font-serif text-xl leading-snug sm:text-2xl" data-testid="daily-prompt-text">
                  {prompt.data?.text ?? "Your daily prompt is on its way — write freely in the meantime."}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  rows={5}
                  placeholder="Write freely — no one else reads this."
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  data-testid="daily-prompt-textarea"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{wordCount(reflection)} words</span>
                  <Button
                    onClick={() => saveReflection.mutate()}
                    disabled={!reflection.trim() || saveReflection.isPending}
                    data-testid="save-reflection-btn"
                  >
                    {saveReflection.isPending ? "Saving…" : writtenToday ? "Save another" : "Save reflection"}
                  </Button>
                </div>
                {writtenToday && (
                  <p className="text-xs font-medium text-[#1B6B45]" data-testid="written-today-note">
                    You've already reflected on today's question — adding more is always welcome.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Mood check-in strip */}
            <Card data-testid="mood-checkin-card">
              <CardHeader>
                <CardTitle className="font-serif text-xl">Quick mood check-in</CardTitle>
                <CardDescription>One honest tap a day reveals your patterns.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MoodStones value={mood} onChange={setMood} />
                {mood && (
                  <div className="animate-fade-up space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Energy</span>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={energy}
                        onChange={(e) => setEnergy(Number(e.target.value))}
                        className="h-1.5 w-40 cursor-pointer"
                        data-testid="energy-slider"
                        aria-label="Energy level"
                      />
                      <span className="text-sm font-medium" data-testid="energy-value">
                        {energy}/10
                      </span>
                    </div>
                    <Input
                      placeholder="Optional note — what's behind the mood?"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={200}
                      data-testid="mood-note-input"
                    />
                    <Button size="sm" onClick={() => saveMood.mutate()} disabled={saveMood.isPending} data-testid="save-mood-btn">
                      {saveMood.isPending ? "Saving…" : "Log mood"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Growth Whisperer */}
            <Card className="border-[#E2D8C3] bg-[#F7F3EB]" data-testid="ai-insight-card">
              <CardHeader>
                <CardDescription className="text-xs font-medium uppercase tracking-[0.16em] text-[#7C3A21]">AI reflection assistant</CardDescription>
                <CardTitle className="font-serif text-xl">The Growth Whisperer</CardTitle>
                <CardDescription>
                  A gentle read of your recent entries and moods — recurring themes, stress signals, and small next steps.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => stress.mutate()}
                  disabled={stress.isPending}
                  data-testid="ai-insights-button"
                >
                  <Wand2 className="size-4" /> {stress.isPending ? "Reading your week…" : "Read my patterns"}
                </Button>
                {stress.data && (
                  <div className="animate-fade-up mt-4 space-y-3" data-testid="ai-insight-result">
                    <Badge
                      variant={stress.data.stress_level === "high" ? "destructive" : stress.data.stress_level === "moderate" ? "secondary" : "default"}
                      data-testid="stress-level-badge"
                    >
                      {stress.data.stress_level === "high"
                        ? "High stress signals"
                        : stress.data.stress_level === "moderate"
                          ? "Moderate stress signals"
                          : "Mostly settled"}
                    </Badge>
                    {stress.data.patterns.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">What it noticed</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm" data-testid="ai-pattern-list">
                          {stress.data.patterns.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {stress.data.suggestions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gentle next steps</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm" data-testid="ai-suggestion-list">
                          {stress.data.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Streak & stats bento */}
            <Card data-testid="streak-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <span className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                    <Flame className="size-7 text-primary" />
                  </span>
                  <div>
                    <div className="font-serif text-4xl" data-testid="streak-count">
                      {dash.data.streak}
                    </div>
                    <div className="text-sm text-muted-foreground">day reflection streak</div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Longest", value: dash.data.longest_streak, id: "stat-longest" },
                    { label: "Entries", value: dash.data.total_entries, id: "stat-entries" },
                    { label: "Moods", value: dash.data.total_moods, id: "stat-moods" },
                  ].map((s) => (
                    <div key={s.id} className="rounded-xl bg-secondary p-2">
                      <div className="font-serif text-lg" data-testid={s.id}>
                        {s.value}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Badges */}
            <Card data-testid="badges-card">
              <CardHeader>
                <CardTitle className="font-serif text-lg">Achievement badges</CardTitle>
                <CardDescription>{dash.data.badges.filter((b) => b.earned).length} of {dash.data.badges.length} earned</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {dash.data.badges.map((b) => (
                  <div
                    key={b.key}
                    data-testid={`badge-${b.key}`}
                    className={cn("rounded-xl border p-3 text-center", b.earned ? "border-primary/30 bg-primary/5" : "opacity-45")}
                  >
                    <Medal className={cn("mx-auto size-5", b.earned ? "text-primary" : "text-muted-foreground")} />
                    <div className="mt-1 text-xs font-semibold">{b.label}</div>
                    <div className="text-[11px] leading-snug text-muted-foreground">{b.description}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent reflections */}
            <Card data-testid="recent-card">
              <CardHeader>
                <CardTitle className="font-serif text-lg">Recent reflections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dash.data.recent_entries.length === 0 && (
                  <p className="text-sm text-muted-foreground">Your sanctuary is quiet — the first entry is a good one.</p>
                )}
                {dash.data.recent_entries.map((e) => (
                  <div key={e.id} className="rounded-xl border p-3" data-testid="recent-entry-card">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{categoryLabel(e.category)}</Badge>
                      {e.mood && <span className={cn("size-2.5 rounded-full", MOOD_META[e.mood].color)} aria-label={`Mood: ${MOOD_META[e.mood].label}`} />}
                    </div>
                    <div className="mt-2 font-serif text-sm font-medium">{e.title}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.content}</p>
                    <div className="mt-2 text-xs text-muted-foreground">{fmtDate(e.created_at)}</div>
                  </div>
                ))}
                <Link to="/journal" className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline" data-testid="recent-open-journal-link">
                  Open the full journal
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
