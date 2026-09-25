import { MOODS, MOOD_META, type Mood } from "@/lib/types";
import { cn } from "@/lib/utils";

// Tactile 5-stone mood selector — shared by the dashboard strip and the mood page.
export default function MoodStones({
  value,
  onChange,
  disabled,
}: {
  value: Mood | null;
  onChange: (mood: Mood) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="mood-stones">
      {MOODS.map((mood) => {
        const meta = MOOD_META[mood];
        const selected = value === mood;
        return (
          <button
            key={mood}
            type="button"
            disabled={disabled}
            aria-label={`Mood: ${meta.label}`}
            aria-pressed={selected}
            data-testid={`mood-stone-${mood}`}
            onClick={() => onChange(mood)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-50 motion-reduce:transition-none",
              selected
                ? `border-transparent text-white shadow-md ${meta.color}`
                : "border-border bg-card text-foreground/80 hover:-translate-y-0.5 hover:border-[#C8B99C]",
            )}
          >
            <span className={cn("size-2.5 rounded-full", selected ? "bg-white/80" : meta.color)} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
