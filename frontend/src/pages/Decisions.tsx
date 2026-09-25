import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Scale, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { AiDecisionMirror, Decision, DecisionOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type OptDraft = { name: string; pros: string; cons: string; values_fit: number; energy_cost: number };
const emptyOpt = (): OptDraft => ({ name: "", pros: "", cons: "", values_fit: 3, energy_cost: 3 });
const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function MiniSlider({ label, value, onChange, testId }: { label: string; value: number; onChange: (v: number) => void; testId: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer"
        data-testid={testId}
        aria-label={label}
      />
      <span className="w-8 text-right text-sm font-medium">{value}/5</span>
    </div>
  );
}

export default function Decisions() {
  const qc = useQueryClient();
  const decisions = useQuery({ queryKey: ["decisions"], queryFn: () => apiGet<Decision[]>("/decisions"), retry: false });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dilemma, setDilemma] = useState("");
  const [options, setOptions] = useState<OptDraft[]>([emptyOpt(), emptyOpt()]);
  const [tenM, setTenM] = useState("");
  const [tenMo, setTenMo] = useState("");
  const [tenY, setTenY] = useState("");
  const [gut, setGut] = useState("");
  const [armedId, setArmedId] = useState<string | null>(null);
  const [mirrors, setMirrors] = useState<Record<string, AiDecisionMirror>>({});

  const resetForm = () => {
    setTitle("");
    setDilemma("");
    setOptions([emptyOpt(), emptyOpt()]);
    setTenM("");
    setTenMo("");
    setTenY("");
    setGut("");
  };

  const save = useMutation({
    mutationFn: () => {
      const named = options.filter((o) => o.name.trim());
      return apiPost<Decision>("/decisions", {
        title: title.trim(),
        dilemma: dilemma.trim(),
        options: named.map((o) => ({
          name: o.name.trim(),
          pros: lines(o.pros),
          cons: lines(o.cons),
          values_fit: o.values_fit,
          energy_cost: o.energy_cost,
        })),
        ten_ten_ten: Object.fromEntries(
          [
            ["minutes", tenM.trim()],
            ["months", tenMo.trim()],
            ["years", tenY.trim()],
          ].filter(([, v]) => v),
        ),
        gut_feeling: gut.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Decision saved to your archive");
      setOpen(false);
      resetForm();
      void qc.invalidateQueries({ queryKey: ["decisions"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { status?: "open" | "decided"; chosen_option?: string } }) =>
      apiPatch<Decision>(`/decisions/${id}`, patch),
    onSuccess: () => {
      toast.success("Decision updated");
      void qc.invalidateQueries({ queryKey: ["decisions"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/decisions/${id}`),
    onSuccess: () => {
      toast.success("Decision deleted");
      setArmedId(null);
      void qc.invalidateQueries({ queryKey: ["decisions"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const mirror = useMutation({
    mutationFn: (d: Decision) =>
      apiPost<AiDecisionMirror>("/ai/decision-mirror", { title: d.title, dilemma: d.dilemma, options: d.options }),
    onSuccess: (data, d) => setMirrors((prev) => ({ ...prev, [d.id]: data })),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const canSave = title.trim() && dilemma.trim() && options.filter((o) => o.name.trim()).length >= 2;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl" data-testid="decisions-heading">
            Decisions
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A calm framework for hard choices: frame the dilemma, weigh the options, run the 10/10/10 test, and check your gut.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
          data-testid="new-decision-button"
        >
          <Plus className="size-4" /> New decision
        </Button>
      </header>

      {decisions.isLoading ? (
        <div className="space-y-4" data-testid="decisions-skeleton">
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : decisions.isError ? (
        <div className="rounded-2xl border p-6 text-sm text-muted-foreground" data-testid="decisions-error">
          Could not load your decision archive.
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void decisions.refetch()} data-testid="decisions-retry-button">
            <RefreshCw className="size-4" /> Try again
          </Button>
        </div>
      ) : decisions.data?.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center" data-testid="decisions-empty">
          <Scale className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 font-serif text-lg">No decisions in the workshop</p>
          <p className="mt-1 text-sm text-muted-foreground">The next choice that keeps you up at night belongs here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {decisions.data?.map((d) => (
            <article key={d.id} data-testid="decision-card" className="rounded-2xl border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={d.status === "decided" ? "default" : "secondary"} data-testid="decision-status-badge">
                    {d.status === "decided" ? "Decided" : "Open"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => mirror.mutate(d)}
                    disabled={mirror.isPending}
                    data-testid="ai-mirror-button"
                  >
                    {mirror.isPending && mirror.variables?.id === d.id ? "Reflecting…" : "AI mirror"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={armedId === d.id ? "text-destructive" : "text-muted-foreground"}
                    onClick={() => (armedId === d.id ? del.mutate(d.id) : setArmedId(d.id))}
                    data-testid="delete-decision-button"
                  >
                    <Trash2 className="size-3.5" /> {armedId === d.id ? "Confirm?" : "Delete"}
                  </Button>
                </div>
              </div>

              <h2 className="mt-3 font-serif text-xl font-medium" data-testid="decision-card-title">
                {d.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="decision-card-dilemma">
                {d.dilemma}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {d.options.map((o: DecisionOption, i: number) => (
                  <div key={i} className="rounded-xl border p-4" data-testid="decision-option">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold" data-testid="decision-option-name">
                        {o.name}
                      </span>
                      {d.chosen_option === o.name && <Badge data-testid="chosen-badge">Chosen</Badge>}
                    </div>
                    {o.pros.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-[#1B6B45]" data-testid="decision-option-pros">
                        {o.pros.map((p, j) => (
                          <li key={j}>+ {p}</li>
                        ))}
                      </ul>
                    )}
                    {o.cons.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-[#B42318]" data-testid="decision-option-cons">
                        {o.cons.map((c, j) => (
                          <li key={j}>− {c}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2 flex items-center gap-1.5" title={`Values fit ${o.values_fit}/5, energy cost ${o.energy_cost}/5`}>
                      {Array.from({ length: 5 }, (_, k) => (
                        <span
                          key={k}
                          className={cn("flex h-1.5 w-6 overflow-hidden rounded-full bg-secondary", k < o.values_fit && "bg-primary/30")}
                        >
                          <span className={cn("h-full", k < o.values_fit ? "w-full bg-primary" : "w-0")} />
                        </span>
                      ))}
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        fit {o.values_fit}/5 · cost {o.energy_cost}/5
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {(d.ten_ten_ten.minutes || d.ten_ten_ten.months || d.ten_ten_ten.years) && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="decision-ten-ten-ten">
                  {(
                    [
                      ["In 10 minutes", d.ten_ten_ten.minutes],
                      ["In 10 months", d.ten_ten_ten.months],
                      ["In 10 years", d.ten_ten_ten.years],
                    ] as const
                  )
                    .filter(([, v]) => v)
                    .map(([label, v]) => (
                      <div key={label} className="rounded-xl bg-secondary p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
                        <p className="mt-1 text-sm">{v}</p>
                      </div>
                    ))}
                </div>
              )}

              {d.gut_feeling && (
                <p className="mt-4 font-serif text-sm italic text-muted-foreground" data-testid="decision-gut-feeling">
                  Gut check: {d.gut_feeling}
                </p>
              )}

              {d.status === "open" ? (
                <div className="mt-4">
                  <Select
                    onValueChange={(value) => update.mutate({ id: d.id, patch: { status: "decided", chosen_option: value } })}
                  >
                    <SelectTrigger className="w-full sm:w-72" data-testid="decide-select">
                      <SelectValue>Mark as decided…</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {d.options.map((o, i) => (
                        <SelectItem key={i} value={o.name}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                d.chosen_option && (
                  <p className="mt-4 text-sm font-medium" data-testid="decision-outcome">
                    You chose: <span className="text-primary">{d.chosen_option}</span>
                  </p>
                )
              )}

              {mirrors[d.id] && (
                <div className="animate-fade-up mt-4 rounded-xl border border-[#E2D8C3] bg-[#F7F3EB] p-4" data-testid="ai-mirror-panel">
                  <p className="text-sm leading-relaxed">{mirrors[d.id].feedback}</p>
                  {mirrors[d.id].risks.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" data-testid="ai-mirror-risks">
                      {mirrors[d.id].risks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {mirrors[d.id].confidence && (
                    <p className="mt-2 font-serif text-sm italic text-[#7C3A21]" data-testid="ai-mirror-confidence">
                      {mirrors[d.id].confidence}
                    </p>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* New decision dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" data-testid="decision-editor-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl" data-testid="decision-editor-title">
              A decision worth framing
            </DialogTitle>
            <DialogDescription>Work through it slowly — the framework does the untangling.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="decision-title">What are you deciding?</Label>
              <Input
                id="decision-title"
                placeholder="e.g. Summer research internship or the café job?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                data-testid="decision-title-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="decision-dilemma">Frame the dilemma</Label>
              <Textarea
                id="decision-dilemma"
                rows={3}
                placeholder="What's pulling you in each direction, honestly?"
                value={dilemma}
                onChange={(e) => setDilemma(e.target.value)}
                data-testid="decision-dilemma-textarea"
              />
            </div>

            {options.map((opt, i) => (
              <div key={i} className="space-y-3 rounded-xl border p-4" data-testid={`option-editor-${i}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Option {i + 1}</span>
                  {options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove option ${i + 1}`}
                      onClick={() => setOptions(options.filter((_, j) => j !== i))}
                      data-testid={`remove-option-${i}`}
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
                <Input
                  placeholder={`Name option ${i + 1} (e.g. Take the internship)`}
                  value={opt.name}
                  onChange={(e) => setOptions(options.map((o, j) => (j === i ? { ...o, name: e.target.value } : o)))}
                  maxLength={120}
                  data-testid={`option-name-${i}`}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Pros — one per line</Label>
                    <Textarea
                      rows={2}
                      value={opt.pros}
                      onChange={(e) => setOptions(options.map((o, j) => (j === i ? { ...o, pros: e.target.value } : o)))}
                      data-testid={`option-pros-${i}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cons — one per line</Label>
                    <Textarea
                      rows={2}
                      value={opt.cons}
                      onChange={(e) => setOptions(options.map((o, j) => (j === i ? { ...o, cons: e.target.value } : o)))}
                      data-testid={`option-cons-${i}`}
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <MiniSlider
                    label="Values fit"
                    value={opt.values_fit}
                    onChange={(v) => setOptions(options.map((o, j) => (j === i ? { ...o, values_fit: v } : o)))}
                    testId={`option-values-fit-${i}`}
                  />
                  <MiniSlider
                    label="Energy cost"
                    value={opt.energy_cost}
                    onChange={(v) => setOptions(options.map((o, j) => (j === i ? { ...o, energy_cost: v } : o)))}
                    testId={`option-energy-cost-${i}`}
                  />
                </div>
              </div>
            ))}
            {options.length < 4 && (
              <Button variant="outline" size="sm" onClick={() => setOptions([...options, emptyOpt()])} data-testid="add-option-button">
                <Plus className="size-4" /> Add another option
              </Button>
            )}

            <div className="grid gap-3 sm:grid-cols-3" data-testid="ten-ten-ten-editors">
              {(
                [
                  ["In 10 minutes", tenM, setTenM, "ten-minutes-input"],
                  ["In 10 months", tenMo, setTenMo, "ten-months-input"],
                  ["In 10 years", tenY, setTenY, "ten-years-input"],
                ] as const
              ).map(([label, value, setter, testId]) => (
                <div key={label} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Textarea
                    rows={2}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    data-testid={testId}
                    placeholder="How does it feel…"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gut-feeling">Gut check</Label>
              <Input
                id="gut-feeling"
                placeholder="What does your gut whisper when nobody's watching?"
                value={gut}
                onChange={(e) => setGut(e.target.value)}
                maxLength={2000}
                data-testid="gut-feeling-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending} data-testid="save-decision-button">
              {save.isPending ? "Saving…" : "Save decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
