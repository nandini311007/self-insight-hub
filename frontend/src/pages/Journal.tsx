import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw, Search, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from "@/lib/api";
import { fmtDate, wordCount } from "@/lib/format";
import {
  CATEGORIES,
  categoryLabel,
  MOODS,
  MOOD_META,
  type AiPrompts,
  type AiSummary,
  type Category,
  type JournalEntry,
  type Mood,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const NO_MOOD = "none";

export default function Journal() {
  const qc = useQueryClient();
  const entries = useQuery({ queryKey: ["journal"], queryFn: () => apiGet<JournalEntry[]>("/journal"), retry: false });

  const [filter, setFilter] = useState<"all" | Category>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>("freeform");
  const [mood, setMood] = useState<string>(NO_MOOD);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [aiPrompts, setAiPrompts] = useState<AiPrompts | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (entries.data ?? [])
      .filter((e) => filter === "all" || e.category === filter)
      .filter((e) => !q || e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q));
  }, [entries.data, filter, search]);

  const resetEditor = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setCategory("freeform");
    setMood(NO_MOOD);
    setAiSummary(null);
    setAiPrompts(null);
  };

  const openEditor = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setContent(entry.content);
    setCategory(entry.category);
    setMood(entry.mood ?? NO_MOOD);
    setAiSummary(null);
    setAiPrompts(null);
    setOpen(true);
  };

  const afterSave = () => {
    void qc.invalidateQueries({ queryKey: ["journal"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["streak"] });
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim() || "Untitled reflection",
        content: content.trim(),
        category,
        mood: mood === NO_MOOD ? null : (mood as Mood),
      };
      return editingId
        ? apiPatch<JournalEntry>(`/journal/${editingId}`, payload)
        : apiPost<JournalEntry>("/journal", payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Reflection updated" : "Reflection saved to your sanctuary");
      setOpen(false);
      resetEditor();
      afterSave();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/journal/${id}`),
    onSuccess: () => {
      toast.success("Entry deleted");
      setArmedId(null);
      afterSave();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const summarize = useMutation({
    mutationFn: () => apiPost<AiSummary>("/ai/summarize", { content }),
    onSuccess: (data) => setAiSummary(data),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const suggest = useMutation({
    mutationFn: () => apiPost<AiPrompts>("/ai/prompt-suggestions", { content }),
    onSuccess: (data) => setAiPrompts(data),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl" data-testid="journal-heading">
            Journal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {entries.data ? `${entries.data.length} private ${entries.data.length === 1 ? "reflection" : "reflections"}` : "Your private reflection space"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reflections…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 sm:w-56"
              data-testid="journal-search-input"
            />
          </div>
          <Button
            onClick={() => {
              resetEditor();
              setOpen(true);
            }}
            data-testid="new-entry-button"
          >
            <Plus className="size-4" /> New entry
          </Button>
        </div>
      </header>

      <Tabs value={filter} onValueChange={(value) => setFilter(String(value) as "all" | Category)}>
        <TabsList data-testid="journal-filter-tabs">
          <TabsTrigger value="all" data-testid="journal-tab-all">
            All
          </TabsTrigger>
          <TabsTrigger value="daily_prompt" data-testid="journal-tab-daily_prompt">
            Daily prompts
          </TabsTrigger>
          <TabsTrigger value="freeform" data-testid="journal-tab-freeform">
            Freeform
          </TabsTrigger>
          <TabsTrigger value="milestone" data-testid="journal-tab-milestone">
            Milestones
          </TabsTrigger>
          <TabsTrigger value="decision" data-testid="journal-tab-decision">
            Decisions
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {entries.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="journal-skeleton">
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : entries.isError ? (
        <div className="rounded-2xl border p-6 text-sm text-muted-foreground" data-testid="journal-error">
          Could not load your journal just now.
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void entries.refetch()} data-testid="journal-retry-button">
            <RefreshCw className="size-4" /> Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center" data-testid="journal-empty">
          <p className="font-serif text-lg">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {entries.data?.length ? "No entries match this filter." : "Your first reflection is one sentence away."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((e) => (
            <article
              key={e.id}
              data-testid="entry-card"
              className="flex flex-col rounded-2xl border bg-card p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-[#C8B99C] hover:shadow-[0_10px_30px_rgba(40,30,20,0.08)] motion-reduce:transition-none"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{categoryLabel(e.category)}</Badge>
                  {e.mood && <Badge variant="outline">{MOOD_META[e.mood].label}</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">{fmtDate(e.created_at)}</span>
              </div>
              <h2 className="mt-3 font-serif text-lg font-medium leading-snug" data-testid="entry-card-title">
                {e.title}
              </h2>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground" data-testid="entry-card-excerpt">
                {e.content}
              </p>
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="text-xs text-muted-foreground">
                  ~{Math.max(1, Math.round(wordCount(e.content) / 200))} min read
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditor(e)} data-testid="edit-entry-button">
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={armedId === e.id ? "text-destructive" : "text-muted-foreground"}
                    onClick={() => (armedId === e.id ? del.mutate(e.id) : setArmedId(e.id))}
                    data-testid="delete-entry-button"
                  >
                    <Trash2 className="size-3.5" /> {armedId === e.id ? "Confirm?" : "Delete"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl" data-testid="entry-editor-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl" data-testid="entry-editor-title">
              {editingId ? "Edit reflection" : "New reflection"}
            </DialogTitle>
            <DialogDescription>Private to you — write the honest version.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entry-title">Title</Label>
              <Input
                id="entry-title"
                placeholder="Give it a name, or leave it"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                data-testid="entry-title-input"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as Category)}>
                  <SelectTrigger className="w-full" data-testid="entry-category-select">
                    <SelectValue>{CATEGORIES.find((c) => c.value === category)?.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mood tag</Label>
                <Select value={mood} onValueChange={(value) => setMood(value)}>
                  <SelectTrigger className="w-full" data-testid="entry-mood-select">
                    <SelectValue>{mood === NO_MOOD ? "No mood tag" : MOOD_META[mood as Mood].label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_MOOD}>No mood tag</SelectItem>
                    {MOODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MOOD_META[m].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-content">Reflection</Label>
              <Textarea
                id="entry-content"
                rows={9}
                placeholder="What happened, what it stirred, what it taught…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                data-testid="entry-content-textarea"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{wordCount(content)} words</span>
                <span className="text-xs text-muted-foreground">Private to you</span>
              </div>
            </div>

            {/* AI assistant bar */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2D8C3] bg-[#F7F3EB] p-3" data-testid="ai-assist-bar">
              <Wand2 className="size-4 text-[#7C3A21]" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => summarize.mutate()}
                disabled={!content.trim() || summarize.isPending}
                data-testid="ai-summarize-button"
              >
                {summarize.isPending ? "Thinking…" : "AI summary"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => suggest.mutate()}
                disabled={!content.trim() || suggest.isPending}
                data-testid="ai-questions-button"
              >
                {suggest.isPending ? "Thinking…" : "Follow-up questions"}
              </Button>
            </div>
            {(aiSummary || aiPrompts) && (
              <div className="animate-fade-up space-y-3 rounded-xl border border-[#E2D8C3] bg-[#F7F3EB] p-4" data-testid="ai-assist-panel">
                {aiSummary && (
                  <div data-testid="ai-summary-result">
                    <p className="text-sm leading-relaxed">{aiSummary.summary}</p>
                    {aiSummary.themes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {aiSummary.themes.map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {aiSummary.gentle_note && <p className="mt-2 font-serif text-sm italic text-[#7C3A21]">{aiSummary.gentle_note}</p>}
                  </div>
                )}
                {aiPrompts && (
                  <ul className="space-y-1.5" data-testid="ai-questions-result">
                    {aiPrompts.prompts.map((q, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="text-left text-sm text-primary underline-offset-4 hover:underline"
                          onClick={() => setContent((c) => (c.trim() ? `${c}\n\n${q}` : q))}
                          data-testid={`use-prompt-${i}`}
                          title="Add this question to your entry"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => save.mutate()}
              disabled={!content.trim() || save.isPending}
              data-testid="save-entry-button"
            >
              {save.isPending ? "Saving…" : editingId ? "Save changes" : "Save reflection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
