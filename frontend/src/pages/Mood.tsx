import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "@/lib/recharts";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import {
  MOODS,
  MOOD_META,
  type AiStress,
  type DailyPrompt,
  type Mood,
  type MoodLog,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import MoodStones from "@/components/MoodStones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const SCORE_LABEL: Record<number, string> = {
  1: "Drained",
  2: "Anxious",
  3: "Reflective",
  4: "Calm",
  5: "Joyful",
};

export default function Mood() {
  const qc = useQueryClient();
  const logs = useQuery({ queryKey: ["mood"], queryFn: () => apiGet<MoodLog[]>("/mood"), retry: false });
  const prompt = useQuery({ queryKey: ["dailyPrompt"], queryFn: () => apiGet<DailyPrompt>("/prompts/daily"), retry: false });

  const [pickedMood, setPickedMood] = useState<Mood | null>(null);
  const [energySet, setEnergySet] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  const serverToday = prompt.data?.date; // server-anchored "today" — never client date math
  const todayLog = useMemo(
    () => logs.data?.find((l) => l.date === serverToday) ?? null,
    [logs.data, serverToday],
  );

  const effectiveMood = pickedMood ?? todayLog?.mood ?? null;
  const effectiveEnergy = energySet ?? todayLog?.energy ?? 5;

  const save = useMutation({
    mutationFn: () => apiPost<MoodLog>("/mood", { mood: effectiveMood as Mood, energy: effectiveEnergy, note }),
    onSuccess: () => {
      toast.success("Mood logged — small notes, big patterns");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["mood"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["streak"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const stress = useMutation({
    mutationFn: () => apiPost<AiStress>("/ai/stress-patterns", {}),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const series = useMemo(() => {
    const base = serverToday ? parseISO(serverToday) : new Date();
    const byDate = new Map((logs.data ?? []).map((l) => [l.date, l]));
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() - (13 - i));
      const key = format(d, "yyyy-MM-dd");
      const log = byDate.get(key);
      return { date: key, score: log ? MOOD_META[log.mood].score : null, mood: log?.mood ?? null };
    });
  }, [logs.data, serverToday]);

  const history = (logs.data ?? []).filter((l) => historyFilter === "all" || l.mood === historyFilter);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl" data-testid="mood-heading">
          Mood
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Your emotional weather, one honest check-in at a time.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Check-in */}
        <Card data-testid="mood-checkin-card">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Today's check-in</CardTitle>
            <CardDescription>{todayLog ? "You've checked in today — updating is welcome." : "How is today landing for you?"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MoodStones value={effectiveMood} onChange={setPickedMood} />
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Energy</span>
              <input
                type="range"
                min={1}
                max={10}
                value={effectiveEnergy}
                onChange={(e) => setEnergySet(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer"
                data-testid="energy-slider"
                aria-label="Energy level"
              />
              <span className="w-10 text-right text-sm font-medium" data-testid="energy-value">
                {effectiveEnergy}/10
              </span>
            </div>
            <Textarea
              rows={2}
              placeholder="Optional note — what's behind the mood?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              data-testid="mood-note-input"
            />
            <Button
              onClick={() => save.mutate()}
              disabled={!effectiveMood || save.isPending}
              data-testid="save-mood-btn"
            >
              {save.isPending ? "Saving…" : todayLog ? "Update today's check-in" : "Log today's mood"}
            </Button>
          </CardContent>
        </Card>

        {/* Flow chart */}
        <Card data-testid="mood-chart-card">
          <CardHeader>
            <CardTitle className="font-serif text-xl">The last 14 days</CardTitle>
            <CardDescription>Days without a check-in show as gaps — honesty over completeness.</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.isLoading ? (
              <div className="h-56 animate-pulse rounded-xl bg-muted" data-testid="mood-chart-skeleton" />
            ) : logs.data && logs.data.length > 0 ? (
              <div className="h-56" data-testid="mood-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                    <defs>
                      <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A65B32" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#A65B32" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => format(parseISO(d), "d MMM")}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      interval="preserveStartEnd"
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                    />
                    <YAxis
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tickFormatter={(v: number) => SCORE_LABEL[v] ?? ""}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      width={72}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => SCORE_LABEL[value] ?? String(value)}
                      labelFormatter={(label: string) => format(parseISO(String(label)), "d MMM yyyy")}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#A65B32"
                      strokeWidth={2}
                      fill="url(#moodFill)"
                      connectNulls={false}
                      dot={{ r: 3, fill: "#A65B32" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="flex h-56 items-center justify-center text-sm text-muted-foreground" data-testid="mood-chart-empty">
                Log your first mood and the pattern appears here.
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI stress patterns */}
        <Card className="border-[#E2D8C3] bg-[#F7F3EB]" data-testid="mood-ai-card">
          <CardHeader>
            <CardDescription className="text-xs font-medium uppercase tracking-[0.16em] text-[#7C3A21]">AI pattern watch</CardDescription>
            <CardTitle className="font-serif text-xl">Stress &amp; clarity signals</CardTitle>
            <CardDescription>Kind pattern detection across your recent moods and entries.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={() => stress.mutate()} disabled={stress.isPending} data-testid="ai-stress-button">
              <Wand2 className="size-4" /> {stress.isPending ? "Reading…" : "Detect my patterns"}
            </Button>
            {stress.data && (
              <div className="animate-fade-up mt-4 space-y-3" data-testid="ai-stress-result">
                <Badge
                  variant={stress.data.stress_level === "high" ? "destructive" : stress.data.stress_level === "moderate" ? "secondary" : "default"}
                  data-testid="mood-stress-level-badge"
                >
                  {stress.data.stress_level === "high"
                    ? "High stress signals"
                    : stress.data.stress_level === "moderate"
                      ? "Moderate stress signals"
                      : "Mostly settled"}
                </Badge>
                <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="mood-pattern-list">
                  {stress.data.patterns.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="mood-suggestion-list">
                  {stress.data.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card data-testid="mood-history-card">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-serif text-xl">History</CardTitle>
            <Select value={historyFilter} onValueChange={(value) => setHistoryFilter(value)}>
              <SelectTrigger className="w-40" data-testid="mood-history-filter">
                <SelectValue>{historyFilter === "all" ? "All moods" : MOOD_META[historyFilter as Mood].label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All moods</SelectItem>
                {MOODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MOOD_META[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-2">
            {logs.isError && (
              <p className="text-sm text-muted-foreground">
                Could not load history.
                <Button variant="outline" size="sm" className="ml-2" onClick={() => void logs.refetch()} data-testid="mood-retry-button">
                  <RefreshCw className="size-4" /> Try again
                </Button>
              </p>
            )}
            {!logs.isError && history.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="mood-history-empty">
                No check-ins match this filter yet.
              </p>
            )}
            {history.slice(0, 12).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border p-3" data-testid="mood-history-row">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", MOOD_META[l.mood].color)} />
                  <span className="text-sm font-medium">{MOOD_META[l.mood].label}</span>
                  <span className="text-xs text-muted-foreground">energy {l.energy}/10</span>
                </div>
                <div className="flex items-center gap-3">
                  {l.note && <span className="hidden max-w-56 truncate text-xs text-muted-foreground sm:block">{l.note}</span>}
                  <span className="text-xs text-muted-foreground">{fmtDate(l.date)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
