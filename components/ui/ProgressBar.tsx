"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  max = 100,
  color,
  className,
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);

  const defaultColor =
    percentage >= 65
      ? "bg-emerald-500"
      : percentage >= 35
      ? "bg-blue-500"
      : "bg-amber-500";

  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all", color || defaultColor)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}