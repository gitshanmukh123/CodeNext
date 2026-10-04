import { cn } from "@/lib/utils";

interface DifficultyBadgeProps {
  platform?: string;
  difficulty?: string;
  rating?: number;
  className?: string;
}

const styles: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  unknown: "bg-muted text-muted-foreground",
};

const difficultyLabels: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  unknown: "Difficulty",
};

const ratingTone = (rating: number) =>
  rating >= 2000
    ? "hard"
    : rating >= 1400
    ? "medium"
    : rating >= 1100
    ? "easy"
    : "unknown";

/**
 * Shows a problem's difficulty. Codeforces problems display their numeric
 * rating (e.g. "CF 1400"), LeetCode problems display Easy/Medium/Hard.
 */
export function DifficultyBadge({
  platform,
  difficulty,
  rating,
  className,
}: DifficultyBadgeProps) {
  if (platform === "codeforces" && rating) {
    return (
      <span
        className={cn(
          "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
          styles[ratingTone(rating)],
          className
        )}
      >
        CF · {rating}
      </span>
    );
  }

  const label = difficulty ? difficulty.trim().toLowerCase() : "unknown";
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
        styles[label] || styles.unknown,
        className
      )}
    >
      {difficultyLabels[label] || label || "Difficulty"}
    </span>
  );
}