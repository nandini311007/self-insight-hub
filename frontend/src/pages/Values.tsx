import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Compass, RefreshCw, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { type JournalEntry, type ValuesResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { valueTestId, VALUES_POOL } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const MAX_VALUES = 5;

export default function Values() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const result = useQuery({ queryKey: ["values"], queryFn: () => apiGet<ValuesResult | null>("/values/result"), retry: false });

  // "Dirty" state: null means "use the saved result", so refetches never clobber local edits.
  const [picked, setPicked] = useState<string[] | null>(null);
  const [defs, setDefs] = useState<Record<string, string>>({});
  const [alignment, setAlignment] = useState<number | null>(null);

  const top = picked ?? result.data?.top_values ?? [];
  const defFor = (v: string) => defs[v] ?? result.data?.definitions?.[v] ?? "";
  const align = alignment ?? result.data?.alignment ?? 5;

  const toggle = (v: string) => {
    if (top.includes(v)) {
      setPicked(top.filter((x) => x !== v));
    } else if (top.length >= MAX_VALUES) {
      toast.error(`Five values is the sweet spot — remove one first`);
    } else {
      setPicked([...top, v]);
    }
  };

  const save = useMutation({
    mutationFn: () => {
      const definitions: Record<string, string> = {};
      for (const v of top) {
        const d = defFor(v).trim();
        if (d) definitions[v] = d;
      }
      return apiPost<ValuesResult>("/values/result", { top_values: top, definitions, alignment: align });
    },
    onSuccess: () => {
      toast.success("Your values compass is set");
      void qc.invalidateQueries({ queryKey: ["values"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const suggest = useMutation({
    mutationFn: () => apiPost<{ prompts: string[] }>("/ai/prompt-suggestions", { values: top }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const journalOn = useMutation({
    mutationFn: (prompt: string) =>
      apiPost<JournalEntry>("/journal", {
        title: prompt.slice(0, 80),
        content: prompt,
        category: "freeform",
        prompt_text: prompt,
      }),
    onSuccess: () => {
      toast.success("Prompt saved as a journal entry");
      void qc.invalidateQueries({ queryKey: ["journal"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/journal");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl" data-testid="values-heading">
          Values
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pick up to five values that feel most essentially you — the ones you'd defend on a hard day. Order matters: the
          first pick is your true north.
        </p>
      </header>

      {result.isError && (
        <div className="rounded-2xl border p-4 text-sm text-muted-foreground" data-testid="values-error">
          Could not load your saved compass.
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void result.refetch()} data-testid="values-retry-button">
            <RefreshCw className="size-4" /> Try again
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pool */}
        <Card className="lg:col-span-2" data-testid="values-pool-card">
          <CardHeader>
            <CardTitle className="font-serif text-xl">The value pool</CardTitle>
            <CardDescription>Tap to rank a value into your compass. Tap again to remove it.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {VALUES_POOL.map((v) => {
              const rank = top.indexOf(v);
              const selected = rank !== -1;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggle(v)}
                  data-testid={valueTestId(v)}
                  aria-pressed={selected}
                  className={cn(
                    "relative rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 active:scale-95 motion-reduce:transition-none",
                    selected
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-card text-foreground/80 hover:-translate-y-0.5 hover:border-[#C8B99C]",
                  )}
                >
                  {v}
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground" data-testid={`value-rank-${rank + 1}`}>
                      {rank + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Compass + definitions + alignment */}
        <div className="space-y-6">
          <Card data-testid="values-compass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-xl">
                <Compass className="size-5 text-primary" /> Your compass
              </CardTitle>
              <CardDescription>{top.length ? `${top.length} of ${MAX_VALUES} chosen` : "Nothing chosen yet"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {top.length === 0 && <p className="text-sm text-muted-foreground">Your picks appear here in order.</p>}
              {top.map((v, i) => (
                <div key={v} className="rounded-xl border p-3" data-testid={`compass-item-${i + 1}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold">{v}</span>
                    </div>
                    <Button variant="ghost" size="icon-xs" aria-label={`Remove ${v}`} onClick={() => toggle(v)} data-testid={`remove-value-${i}`}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                  <Input
                    placeholder={`What does ${v.toLowerCase()} mean to you? (optional)`}
                    value={defFor(v)}
                    onChange={(e) => setDefs({ ...defs, [v]: e.target.value })}
                    className="mt-2"
                    maxLength={120}
                    data-testid={`definition-input-${i}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card data-testid="alignment-card">
            <CardHeader>
              <CardTitle className="font-serif text-lg">This week's alignment</CardTitle>
              <CardDescription>How closely did your days match your compass?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={align}
                  onChange={(e) => setAlignment(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer"
                  data-testid="alignment-slider"
                  aria-label="Values alignment this week"
                />
                <span className="w-10 text-right text-sm font-medium" data-testid="alignment-value">
                  {align}/10
                </span>
              </div>
              <Button className="w-full" onClick={() => save.mutate()} disabled={!top.length || save.isPending} data-testid="save-values-btn">
                {save.isPending ? "Saving…" : "Save my compass"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI prompts from values */}
      <Card className="border-[#E2D8C3] bg-[#F7F3EB]" data-testid="values-ai-card">
        <CardHeader>
          <CardDescription className="text-xs font-medium uppercase tracking-[0.16em] text-[#7C3A21]">AI reflection path</CardDescription>
          <CardTitle className="font-serif text-xl">Prompts drawn from your compass</CardTitle>
          <CardDescription>Reflection questions tuned to the values you chose.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" onClick={() => suggest.mutate()} disabled={!top.length || suggest.isPending} data-testid="values-ai-prompts-btn">
            <Wand2 className="size-4" /> {suggest.isPending ? "Designing…" : "Suggest prompts from my values"}
          </Button>
          {suggest.data && (
            <ul className="space-y-2" data-testid="values-ai-prompts-list">
              {suggest.data.prompts.map((q, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-xl border border-[#E2D8C3] bg-card p-3">
                  <span className="text-sm">{q}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => journalOn.mutate(q)}
                    disabled={journalOn.isPending}
                    data-testid={`journal-prompt-${i}`}
                  >
                    Journal on this
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {!top.length && <p className="text-sm text-muted-foreground">Choose at least one value first.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
