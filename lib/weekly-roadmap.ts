"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getProblemKey } from "@/lib/recommender";
import { NormalizedProblem, Platform } from "@/types";

export type WeekProblemStatus = "pending" | "solved" | "skipped";

export interface WeeklyRoadmapProblem {
  key: string;
  title: string;
  platform: Platform;
  externalId: string;
  url: string;
  difficulty?: string;
  rating?: number;
  tags: string[];
  concept: string;
  type: string;
  reason: string;
  status: WeekProblemStatus;
}

export interface WeeklyRoadmapDay {
  date: string;
  day: string;
  theme: string;
  problems: WeeklyRoadmapProblem[];
}

export interface WeeklyRoadmapEntry {
  profileId: string;
  weekStart: string;
  platform: Platform | null;
  generatedAt: string;
  days: WeeklyRoadmapDay[];
}

interface WeeklyRoadmapStore {
  version: number;
  entries: Record<string, WeeklyRoadmapEntry>;
}

const STORAGE_KEY = "codenext-weekly-roadmap";

export function getWeekStart(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().split("T")[0];
}

export function addDays(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function formatWeekLabel(startDate: string): string {
  const start = new Date(startDate + "T00:00:00");
  const endDate = new Date(addDays(startDate, 6) + "T00:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(endDate)}`;
}

/**
 * Composite key for a weekly plan. Keeps the mixed, Codeforces-only, and
 * LeetCode-only weeks separate so switching modes never clears progress.
 */
export function weeklyEntryKey(entry: {
  profileId: string;
  weekStart: string;
  platform: Platform | null;
}): string {
  return `${entry.profileId}|${entry.weekStart}|${entry.platform || "mixed"}`;
}

export function buildWeeklyEntry(
  profileId: string,
  weekStart: string,
  platform: Platform | null,
  days: {
    day: string;
    theme: string;
    problems: {
      problem: NormalizedProblem;
      concept: string;
      type: string;
      reason: string;
    }[];
  }[]
): WeeklyRoadmapEntry {
  return {
    profileId,
    weekStart,
    platform: platform || null,
    generatedAt: new Date().toISOString(),
    days: days.map((day, i) => ({
      date: addDays(weekStart, i),
      day: day.day,
      theme: day.theme,
      problems: day.problems.map((p) => ({
        key: getProblemKey(p.problem),
        title: p.problem.title,
        platform: p.problem.platform,
        externalId: p.problem.externalId,
        url: p.problem.url,
        difficulty: p.problem.difficulty,
        rating: p.problem.rating,
        tags: p.problem.tags,
        concept: p.concept,
        type: p.type,
        reason: p.reason,
        status: "pending",
      })),
    })),
  };
}

const EMPTY_STORE: WeeklyRoadmapStore = Object.freeze({
  version: 1,
  entries: {},
});

function emptyStore(): WeeklyRoadmapStore {
  return EMPTY_STORE;
}

let cache: { raw: string | null; parsed: WeeklyRoadmapStore } = {
  raw: null,
  parsed: EMPTY_STORE,
};

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): WeeklyRoadmapStore {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cache.raw) return cache.parsed;
  try {
    const parsed: WeeklyRoadmapStore = raw
      ? (JSON.parse(raw) as WeeklyRoadmapStore)
      : EMPTY_STORE;
    // Migrate legacy entries (keyed by profileId only) to composite keys so
    // progress from before the multi-mode change is not lost.
    const entries = { ...parsed.entries };
    let migrated = false;
    for (const [key, entry] of Object.entries(entries)) {
      if (entry?.profileId && entry.weekStart && key === entry.profileId) {
        const newKey = weeklyEntryKey(entry);
        if (newKey !== key) {
          entries[newKey] = entry;
          delete entries[key];
          migrated = true;
        }
      }
    }
    cache = { raw, parsed: migrated ? { ...parsed, entries } : parsed };
  } catch {
    cache = { raw, parsed: EMPTY_STORE };
  }
  return cache.parsed;
}

function getServerSnapshot(): WeeklyRoadmapStore {
  return emptyStore();
}

function write(next: WeeklyRoadmapStore) {
  const raw = JSON.stringify(next);
  localStorage.setItem(STORAGE_KEY, raw);
  cache = { raw, parsed: next };
  window.dispatchEvent(new Event("storage"));
}

/**
 * localStorage-backed weekly roadmap store.
 *
 * The entire current week (Mon–Sun) is persisted per profile and keyed by the
 * Monday of that week. Statuses are stored inline per problem, so progress
 * made on Monday is restored when you reopen the app on Thursday. Starting a
 * new week resets the plan (old weeks are dropped — the roadmap only ever
 * covers *this* week).
 */
export function useWeeklyRoadmap(
  profileId?: string,
  weekStart?: string,
  platform?: Platform | null
) {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const key = useMemo(
    () =>
      profileId && weekStart
        ? weeklyEntryKey({ profileId, weekStart, platform: platform || null })
        : null,
    [profileId, weekStart, platform]
  );

  const entry = useMemo(
    () => (key ? store.entries[key] || null : null),
    [store.entries, key]
  );

  const saveWeek = useCallback((next: WeeklyRoadmapEntry) => {
    const nextKey = weeklyEntryKey(next);
    const snap = getSnapshot();
    const updated: WeeklyRoadmapStore = {
      ...snap,
      entries: { ...snap.entries, [nextKey]: next },
    };
    write(updated);
  }, []);

  const setStatus = useCallback(
    (problemKey: string, status: WeekProblemStatus) => {
      if (!key) return;
      const current = getSnapshot().entries[key];
      if (!current) return;

      const nextEntry: WeeklyRoadmapEntry = {
        ...current,
        days: current.days.map((day) => ({
          ...day,
          problems: day.problems.map((p) =>
            p.key === problemKey ? { ...p, status } : p
          ),
        })),
      };
      const snap = getSnapshot();
      write({
        ...snap,
        entries: { ...snap.entries, [key]: nextEntry },
      });
    },
    [key]
  );

  const markSolved = useCallback(
    (problemKey: string) => setStatus(problemKey, "solved"),
    [setStatus]
  );

  const markSkipped = useCallback(
    (problemKey: string) => setStatus(problemKey, "skipped"),
    [setStatus]
  );

  const clearWeek = useCallback(() => {
    if (!key) return;
    const snap = getSnapshot();
    const entries = { ...snap.entries };
    delete entries[key];
    write({ ...snap, entries });
  }, [key]);

  const allProblems = useMemo(
    () => (entry ? entry.days.flatMap((d) => d.problems) : []),
    [entry]
  );

  const solvedCount = useMemo(
    () => allProblems.filter((p) => p.status === "solved").length,
    [allProblems]
  );
  const skippedCount = useMemo(
    () => allProblems.filter((p) => p.status === "skipped").length,
    [allProblems]
  );
  const totalCount = allProblems.length;
  const pendingCount = totalCount - solvedCount - skippedCount;
  const completionPct =
    totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

  return {
    entry,
    saveWeek,
    setStatus,
    markSolved,
    markSkipped,
    clearWeek,
    allProblems,
    solvedCount,
    skippedCount,
    pendingCount,
    totalCount,
    completionPct,
  };
}