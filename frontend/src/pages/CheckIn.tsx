import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { WeeklyCheckIn, WeeklyCheckInWindow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const QUESTIONS = [
  { key: "highlight", label: "What stands out most from this week?", placeholder: "The moment you'd tell a friend about…" },
  { key: "wins", label: "What went well — including the small things?", placeholder: "Wins you might otherwise skip past…" },
  { key: "struggles", label: "What was hard, and what did it ask of you?", placeholder: "Honest is more useful than tidy…" },
  { key: "lesson", label: "What did you learn about yourself?", placeholder: "One sentence is plenty…" },
  { key: "intention", label: "What's your intention for next week?", placeholder: "Something specific and kind…" },
] as const;

type Answers = Record<(typeof QUESTIONS)[number]["key"], string>;
const EMPTY: Answers = { highlight: "", wins: "", struggles: "", lesson: "", intention: "" };

export default function CheckIn() {
  const qc = useQueryClient();
  const win = useQuery({ queryKey: ["checkinWindow"], queryFn: () => apiGet<WeeklyCheckInWindow>("/checkins/window"), retry: false });
  const past = useQuery({ queryKey: ["checkins"], queryFn: () => apiGet<WeeklyCheckIn[]>("/checkins"), retry: false });

  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [alignment, setAlignment] = useState(5);
  const [energy, setEnergy] = useState(5);

  // Prefill from this week's saved check-in, if there is one.
  const thisWeek = past.data?.find((c) => c.week_start === win.data?.week_start);
  useEffect(() => {
    if (!thisWeek) return;
    setAnswers({
      highlight: thisWeek.highlight,
      wins: thisWeek.wins,
      struggles: thisWeek.struggles,
      lesson: thisWeek.lesson,
      intention: thisWeek.intention,
    });
    setAlignment(thisWeek.alignment);
    setEnergy(thisWeek.energy);
  }, [thisWeek]);

  const save = useMutation({
    mutationFn: () => apiPost<WeeklyCheckIn>("/checkins", { ...answers, alignment, energy }),
    onSuccess: () => {
      toast.success("Weekly check-in saved", { description: "That's the week seen clearly." });
      void qc.invalidateQueries({ queryKey: ["checkins"] });
      void qc.invalidateQueries({ queryKey: ["checkinWindow"] });
      void qc.invalidateQueries({ queryKey: ["timeline"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const answered = Object.values(answers).filter((v) => v.trim()).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl" data-testid="checkin-heading">
            Weekly check-in
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A Sunday review of the week just lived — five questions, an alignment score, and one intention for what's next.
          </p>
        </div>
        {win.data && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" data-testid="checkin-week-badge">
              {fmtDate(win.data.week_start)} – {fmtDate(win.data.week_end)}
            </Badge>
            {win.data.completed && (
              <Badge data-testid="checkin-completed-badge">
                <CheckCircle2 className="size-3.5" /> Done
              </Badge>
            )}
          </div>
        )}
      </header>

      {win.isError ? (
        <div className="rounded-2xl border p-6 text-sm text-muted-foreground" data-testid="checkin-error">
          Could not load this week's window.
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void win.refetch()} data-testid="checkin-retry-button">
            <RefreshCw className="size-4" /> Try again
          </Button>
        </div>
      ) : (
        <>
          {win.data && !win.data.is_sunday && !win.data.completed && (
            <div className="rounded-2xl border border-[#E2D8C3] bg-[#F7F3EB] p-4 text-sm" data-testid="checkin-not-sunday-note">
              The review is designed for Sundays, but the week is yours — you can fill it in whenever you have a quiet
              twenty minutes.
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2" data-testid="checkin-form-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif text-xl">
                  <CalendarCheck className="size-5 text-primary" /> This week's review
                </CardTitle>
                <CardDescription>{answered} of {QUESTIONS.length} questions answered — partial is fine.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {QUESTIONS.map((q) => (
                  <div key={q.key} className="space-y-2">
                    <Label htmlFor={`checkin-${q.key}`}>{q.label}</Label>
                    <Textarea
                      id={`checkin-${q.key}`}
                      rows={3}
                      placeholder={q.placeholder}
                      value={answers[q.key]}
                      onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                      data-testid={`checkin-${q.key}-textarea`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card data-testid="checkin-scores-card">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">Scores for the week</CardTitle>
                  <CardDescription>Gut answers beat careful ones here.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Values alignment</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={alignment}
                        onChange={(e) => setAlignment(Number(e.target.value))}
                        className="h-1.5 flex-1 cursor-pointer"
                        data-testid="checkin-alignment-slider"
                        aria-label="Values alignment for the week"
                      />
                      <span className="w-10 text-right text-sm font-medium" data-testid="checkin-alignment-value">
                        {alignment}/10
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">How closely did your days match your compass?</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Energy through the week</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={energy}
                        onChange={(e) => setEnergy(Number(e.target.value))}
                        className="h-1.5 flex-1 cursor-pointer"
                        data-testid="checkin-energy-slider"
                        aria-label="Energy for the week"
                      />
                      <span className="w-10 text-right text-sm font-medium" data-testid="checkin-energy-value">
                        {energy}/10
                      </span>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => save.mutate()}
                    disabled={answered === 0 || save.isPending}
                    data-testid="save-checkin-button"
                  >
                    {save.isPending ? "Saving…" : win.data?.completed ? "Update this week" : "Save weekly check-in"}
                  </Button>
                </CardContent>
              </Card>

              <Card data-testid="checkin-history-card">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">Past weeks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {past.data?.length ? (
                    past.data.slice(0, 8).map((c) => (
                      <div key={c.id} className="rounded-xl border p-3" data-testid="checkin-history-row">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">Week of {fmtDate(c.week_start)}</span>
                          <Badge variant="secondary">{c.alignment}/10</Badge>
                        </div>
                        {c.intention && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">Intention: {c.intention}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground" data-testid="checkin-history-empty">
                      No past check-ins yet — this one starts the habit.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
