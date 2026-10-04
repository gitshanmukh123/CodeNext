export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/ /g, "-");
}

export function deslugify(slug: string): string {
  return slug.replace(/-/g, " ");
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getDifficultyColor(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "text-emerald-500";
    case "medium":
      return "text-amber-500";
    case "hard":
      return "text-red-500";
    default:
      return "text-gray-500";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "Strong":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "Developing":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "Weak":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "Unexplored":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "Critical":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "High":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "Medium":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function daysSince(date: string | Date): number {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
