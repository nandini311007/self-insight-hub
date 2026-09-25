import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarCheck, Compass, Flag, RefreshCw, Scale, Smile } from "lucide-react";
import { apiGet } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { MOOD_META, TIMELINE_FILTERS, type TimelineKind, type TimelineOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const KIND_ICON: Record<TimelineKind, typeof BookOpen> = {
  entry: BookOpen,
  mood: Smile,
  checkin: CalendarCheck,
  decision: Scale,
  values: Compass,
  milestone: Flag,
};

const KIND_LABEL: Record<TimelineKind, string> = {
  entry: "Reflection",
  mood: "Mood",
  checkin: "Weekly check-in",
  decision: "Decision",
  values: "Values",
  milestone: "Milestone",
};

export default function Timeline() {
  const timeline = useQuery({ queryKey: ["timeline"], queryFn: () => apiGet<TimelineOut>("/timeline"), retry: false });
  const [filter, setFilter] = useState<"all" | TimelineKind>("all");

  const items = useMemo(
    () => (timeline.data?.items ?? []).filter((i) => filter === "all" || i.kind === filter),
    [timeline.data, filter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const month = item.at.slice(0, 7); // YYYY-MM
      const bucket = map.get(month) ?? [];
      bucket.push(item);
      map.set(month, bucket);
    }
    return Array.from(map.entries());
  }, [items]);

  const monthLabel = (month: string) => {
    const d = new Date(`${month}-01T00:00:00`);
    return isNaN(d.getTime()) ? month : d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl" data-testid="timeline-heading">
          Growth timeline
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Everything you've reflected on, in order — entries, moods, weekly check-ins, decisions and values in one
          scrollable history.
        </p>
      </header>

      <Tabs value={filter} onValueChange={(value) => setFilter(String(value) as "all" | TimelineKind)}>
        <TabsList data-testid="timeline-filter-tabs">
          {TIMELINE_FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} data-testid={`timeline-tab-${f.value}`}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {timeline.isLoading ? (
        <div className="space-y-3" data-testid="timeline-skeleton">
          <div className="h-20 animate-pulse rounded-2xl bg-muted" />
          <div className="h-20 animate-pulse rounded-2xl bg-muted" />
          <div className="h-20 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : timeline.isError ? (
        <div className="rounded-2xl border p-6 text-sm text-muted-foreground" data-testid="timeline-error">
          Could not load your timeline just now.
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void timeline.refetch()} data-testid="timeline-retry-button">
            <RefreshCw className="size-4" /> Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center" data-testid="timeline-empty">
          <p className="font-serif text-lg">Nothing on the timeline yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {timeline.data?.items.length ? "Nothing of this type yet." : "Write a reflection or log a mood to begin your history."}
          </p>
        </div>
      ) : (
        <div className="space-y-8" data-testid="timeline-feed">
          {grouped.map(([month, monthItems]) => (
            <section key={month}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground" data-testid="timeline-month-heading">
                {monthLabel(month)}
              </h2>
              {/* Left rail with dots: the spine of the history */}
              <div className="relative space-y-3 border-l border-border pl-6">
                {monthItems.map((item) => {
                  const Icon = KIND_ICON[item.kind];
                  return (
                    <article
                      key={`${item.kind}-${item.id}`}
                      data-testid="timeline-item"
                      className="relative rounded-2xl border bg-card p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-[#C8B99C] motion-reduce:transition-none"
                    >
                      <span className="absolute top-6 -left-[31px] flex size-5 items-center justify-center rounded-full border border-border bg-background">
                        <Icon className="size-3 text-primary" />
                      </span>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" data-testid="timeline-item-kind">
                            {KIND_LABEL[item.kind]}
                          </Badge>
                          {item.mood && (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className={cn("size-2.5 rounded-full", MOOD_META[item.mood].color)} />
                              {MOOD_META[item.mood].label}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground" data-testid="timeline-item-date">
                          {fmtDate(item.date)}
                        </span>
                      </div>
                      <h3 className="mt-2 font-serif text-lg font-medium leading-snug" data-testid="timeline-item-title">
                        {item.title}
                      </h3>
                      {item.body && (
                        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground" data-testid="timeline-item-body">
                          {item.body}
                        </p>
                      )}
                      {item.meta && <p className="mt-2 text-xs text-muted-foreground/80">{item.meta}</p>}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
