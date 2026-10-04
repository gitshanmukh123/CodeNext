import { cn } from "@/lib/utils";

interface TopicTagsProps {
  tags?: string[];
  className?: string;
  /** Max tags to render before collapsing. Defaults to 3. */
  max?: number;
}

/**
 * Renders a problem's topic tags as small chips. Real LeetCode submissions
 * carry topic slugs; Codeforces submissions carry CF tags. Both are shown
 * transparently so users always see the underlying topics.
 */
export function TopicTags({ tags, className, max = 3 }: TopicTagsProps) {
  const list = (tags || []).filter(Boolean).slice(0, max);
  if (list.length === 0) return null;

  const remaining = (tags || []).length - list.length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {list.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {tag
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          +{remaining}
        </span>
      )}
    </div>
  );
}