import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { COMMUNITY_TOPICS, PEN_NAMES, type CommunityPost, type CommunityPostHeart } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const slug = (t: string) => t.toLowerCase().replace(/\s+/g, "-");

export default function Community() {
  const qc = useQueryClient();
  const posts = useQuery({ queryKey: ["community"], queryFn: () => apiGet<CommunityPost[]>("/community"), retry: false });

  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [penName, setPenName] = useState(() => PEN_NAMES[Math.floor(Math.random() * PEN_NAMES.length)]);
  const [topic, setTopic] = useState<string>(COMMUNITY_TOPICS[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const filtered = (posts.data ?? []).filter((p) => topicFilter === "all" || p.topic === topicFilter);

  const save = useMutation({
    mutationFn: () =>
      apiPost<CommunityPost>("/community", {
        pen_name: penName.trim(),
        topic,
        title: title.trim(),
        body: body.trim(),
      }),
    onSuccess: () => {
      toast.success("Shared with the community — thank you for the honesty");
      setOpen(false);
      setTitle("");
      setBody("");
      setPenName(PEN_NAMES[Math.floor(Math.random() * PEN_NAMES.length)]);
      void qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const heart = useMutation({
    mutationFn: (id: string) => apiPost<CommunityPostHeart>(`/community/${id}/heart`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["community"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl" data-testid="community-heading">
            Community
          </h1>
          <p className="mt-1 flex max-w-2xl items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            Anonymous peer reflections, shared journeys, and mentor insights. Pen names only — never emails, never user
            ids. Be generous; everyone here is mid-chapter.
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          data-testid="new-post-button"
        >
          <Plus className="size-4" /> Share a reflection
        </Button>
      </header>

      <Tabs value={topicFilter} onValueChange={(value) => setTopicFilter(String(value))}>
        <TabsList data-testid="community-topic-tabs">
          <TabsTrigger value="all" data-testid="community-tab-all">
            All
          </TabsTrigger>
          {COMMUNITY_TOPICS.map((t) => (
            <TabsTrigger key={t} value={t} data-testid={`community-tab-${slug(t)}`}>
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {posts.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2" data-testid="community-skeleton">
          <div className="h-44 animate-pulse rounded-2xl bg-muted" />
          <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : posts.isError ? (
        <div className="rounded-2xl border p-6 text-sm text-muted-foreground" data-testid="community-error">
          Could not load the board just now.
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void posts.refetch()} data-testid="community-retry-button">
            <RefreshCw className="size-4" /> Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center" data-testid="community-empty">
          <p className="font-serif text-lg">Quiet board</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {posts.data?.length ? "Nothing under this topic yet." : "Be the first honest voice here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((p) => (
            <Card key={p.id} data-testid="community-card" className="transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(40,30,20,0.08)] motion-reduce:transition-none">
              <CardContent className="flex h-full flex-col p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary font-serif text-sm font-semibold text-accent-foreground">
                    {p.pen_name.charAt(0)}
                  </span>
                  <div>
                    <div className="text-sm font-semibold" data-testid="community-pen-name">
                      {p.pen_name}
                    </div>
                    <div className="text-xs text-muted-foreground">{fmtDate(p.created_at)}</div>
                  </div>
                  <Badge variant="secondary" className="ml-auto">
                    {p.topic}
                  </Badge>
                </div>
                <h2 className="mt-3 font-serif text-lg font-medium leading-snug" data-testid="community-post-title">
                  {p.title}
                </h2>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground" data-testid="community-post-body">
                  {p.body}
                </p>
                <div className="mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => heart.mutate(p.id)}
                    disabled={heart.isPending}
                    data-testid={`heart-button-${p.id}`}
                    aria-label={p.hearted ? "Remove your resonance" : "This resonates with me"}
                    className={cn(p.hearted && "text-primary")}
                  >
                    <Heart className={cn("size-4", p.hearted && "fill-primary")} />
                    {p.hearts} {p.hearts === 1 ? "resonated" : "resonate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New post dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="new-post-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl" data-testid="new-post-title">
              Share anonymously
            </DialogTitle>
            <DialogDescription>Your pen name is all anyone sees. Write the thing you wish you'd read.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pen-name">Pen name</Label>
                <Input
                  id="pen-name"
                  value={penName}
                  onChange={(e) => setPenName(e.target.value)}
                  maxLength={60}
                  data-testid="pen-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Topic</Label>
                <Select value={topic} onValueChange={(value) => setTopic(value)}>
                  <SelectTrigger className="w-full" data-testid="post-topic-select">
                    <SelectValue>{topic}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {COMMUNITY_TOPICS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-title">Title</Label>
              <Input
                id="post-title"
                placeholder="One honest line that sums it up"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                data-testid="post-title-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-body">Your reflection</Label>
              <Textarea
                id="post-body"
                rows={6}
                placeholder="What happened, what it taught you, what you'd tell someone a step behind you…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={5000}
                data-testid="post-body-textarea"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => save.mutate()}
              disabled={!title.trim() || !body.trim() || save.isPending}
              data-testid="submit-post-button"
            >
              {save.isPending ? "Sharing…" : "Share with the community"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
