"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type ProblemStatus = "pending" | "solved" | "skipped";

export interface HistoryProblem {
  key: string;
  title: string;
  platform: string;
  concept: string;
  difficulty?: string;
  rating?: number;
  url: string;
  status: ProblemStatus;
  source: "daily" | "weekly" | "shuffled";
}

export interface RoadmapSession {
  profileId: string;
  date: string;
  problems: HistoryProblem[];
}

interface RoadmapHistory {
  version: number;
  sessions: RoadmapSession[];
}

const STORAGE_KEY = "codenext-roadmap-history";
const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function dateKey(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * DAY_MS).toISOString().split("T")[0];
}

const EMPTY_HISTORY: RoadmapHistory = Object.freeze({
  version: 1,
  sessions: [],
});

function emptyHistory(): RoadmapHistory {
  return EMPTY_HISTORY;
}

let cache: { raw: string | null; parsed: RoadmapHistory } = {
  raw: null,
  parsed: EMPTY_HISTORY,
};

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): RoadmapHistory {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cache.raw) return cache.parsed;
  try {
    cache = { raw, parsed: raw ? (JSON.parse(raw) as RoadmapHistory) : EMPTY_HISTORY };
  } catch {
    cache = { raw, parsed: EMPTY_HISTORY };
  }
  return cache.parsed;
}

function getServerSnapshot(): RoadmapHistory {
  return emptyHistory();
}

function write(next: RoadmapHistory) {
  const raw = JSON.stringify(next);
  localStorage.setItem(STORAGE_KEY, raw);
  cache = { raw, parsed: next };
  window.dispatchEvent(new Event("storage"));
}

/**
 * localStorage-backed roadmap history hook.
 *
 * Tracks every session (one per day per profile), what problems were assigned,
 * and their status (pending / solved / skipped). Persisting solved markers is
 * what enables the NO-REPEAT guarantee: "seen" problem keys are fed back into
 * the recommender so the same question never appears two days in a row.
 */
export function useRoadmapHistory(profileId?: string) {
  const history = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const sessions = useMemo(
    () =>
      profileId
        ? history.sessions
            .filter((s) => s.profileId === profileId)
            .sort((a, b) => b.date.localeCompare(a.date))
        : [],
    [history.sessions, profileId]
  );

  /** Problem keys scheduled within the last `days` days for this profile. */
  const seenProblemIds = useMemo(() => {
    const seen = new Set<string>();
    if (!profileId) return seen;
    for (const session of sessions) {
      if (session.date >= dateKey(WINDOW_DAYS - 1)) {
        for (const p of session.problems) seen.add(p.key);
      }
    }
    return seen;
  }, [sessions, profileId]);

  /**
   * EVERY problem the profile has ever marked solved or skipped in the app,
   * all-time (no 7-day window). Used to guarantee recommendations never
   * repeat a problem that was already practiced — regardless of when.
   */
  const completedProblemIds = useMemo(() => {
    const completed = new Set<string>();
    if (!profileId) return completed;
    for (const session of sessions) {
      for (const p of session.problems) {
        if (p.status === "solved" || p.status === "skipped") {
          completed.add(p.key);
        }
      }
    }
    return completed;
  }, [sessions, profileId]);

  const ensureSession = useCallback(
    (date: string, problems: HistoryProblem[]) => {
      const next: RoadmapHistory = { ...getSnapshot() };
      const idx = next.sessions.findIndex(
        (s) => s.profileId === profileId && s.date === date
      );
      const incoming = problems.map((p) => ({ ...p, status: normalizeStatus(p) }));
      if (idx >= 0) {
        const existing = next.sessions[idx];
        const merged = mergeProblems(existing.problems, incoming);
        next.sessions[idx] = { ...existing, problems: merged };
      } else {
        next.sessions.push({
          profileId: profileId || "anonymous",
          date,
          problems: incoming,
        });
      }
      write(next);
    },
    [profileId]
  );

  const setStatus = useCallback(
    (date: string, problemKey: string, status: ProblemStatus) => {
      const next: RoadmapHistory = { ...getSnapshot() };
      const session = next.sessions.find(
        (s) => s.profileId === profileId && s.date === date
      );
      if (!session) return;
      session.problems = session.problems.map((p) =>
        p.key === problemKey ? { ...p, status } : p
      );
      write(next);
    },
    [profileId]
  );

  const markSolved = useCallback(
    (date: string, problemKey: string) => setStatus(date, problemKey, "solved"),
    [setStatus]
  );

  const markSkipped = useCallback(
    (date: string, problemKey: string) => setStatus(date, problemKey, "skipped"),
    [setStatus]
  );

  const clearProfileHistory = useCallback(() => {
    const next: RoadmapHistory = { ...getSnapshot() };
    next.sessions = next.sessions.filter((s) => s.profileId !== profileId);
    write(next);
  }, [profileId]);

  return {
    sessions,
    seenProblemIds,
    completedProblemIds,
    ensureSession,
    setStatus,
    markSolved,
    markSkipped,
    clearProfileHistory,
  };
}

function normalizeStatus(p: { status?: ProblemStatus }): ProblemStatus {
  return p.status || "pending";
}

function mergeProblems(
  existing: HistoryProblem[],
  incoming: HistoryProblem[]
): HistoryProblem[] {
  const map = new Map<string, HistoryProblem>();
  for (const p of [...existing, ...incoming]) {
    // Incoming wins only when existing is pending (don't erase a solved mark).
    if (!map.has(p.key) || map.get(p.key)!.status === "pending") {
      map.set(p.key, p);
    }
  }
  return [...map.values()];
}

export function getStreak(sessions: RoadmapSession[], profileId?: string): number {
  const mine = profileId
    ? sessions.filter((s) => s.profileId === profileId)
    : sessions;

  const solvedDates = new Set(
    mine
      .filter((s) => s.problems.some((p) => p.status === "solved"))
      .map((s) => s.date)
  );

  let streak = 0;
  let cursor = new Date();
  // A streak survives if you solved today OR you still have today to solve.
  if (!solvedDates.has(getTodayKey())) {
    cursor = new Date(Date.now() - DAY_MS);
  } else {
    streak = 1;
  }

  while (true) {
    const key = new Date(cursor).toISOString().split("T")[0];
    if (!solvedDates.has(key)) break;
    cursor = new Date(cursor.getTime() - DAY_MS);
    streak++;
  }
  return streak;
}

export function getBestStreak(
  sessions: RoadmapSession[],
  profileId?: string
): number {
  const mine = profileId
    ? sessions.filter((s) => s.profileId === profileId)
    : sessions;

  const solvedDates = mine
    .filter((s) => s.problems.some((p) => p.status === "solved"))
    .map((s) => s.date)
    .sort();

  let best = 0;
  let run = 0;
  let prev: Date | null = null;

  for (const date of solvedDates) {
    const d = new Date(date);
    if (prev && d.getTime() - prev.getTime() === DAY_MS) {
      run++;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface HistoryStats {
  totalSessions: number;
  solvedProblems: number;
  assignedProblems: number;
  skippedProblems: number;
  uniqueProblems: number;
  codeforcesSolved: number;
  leetcodeSolved: number;
  codeforcesAssigned: number;
  leetcodeAssigned: number;
  activeDays: number;
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
}

/**
 * Single straightforward function that answers every number the history page
 * shows. One pass over the profile's sessions, no surprises.
 */
export function getHistoryStats(
  sessions: RoadmapSession[],
  profileId?: string
): HistoryStats {
  const mine = profileId
    ? sessions.filter((s) => s.profileId === profileId)
    : sessions;

  let solvedProblems = 0;
  let assignedProblems = 0;
  let skippedProblems = 0;
  let codeforcesSolved = 0;
  let leetcodeSolved = 0;
  let codeforcesAssigned = 0;
  let leetcodeAssigned = 0;

  const unique = new Set<string>();
  const solvedDates = new Set<string>();
  let activeDays = 0;

  for (const session of mine) {
    if (session.problems.length > 0) activeDays++;

    for (const p of session.problems) {
      assignedProblems++;
      unique.add(p.key);
      if (p.platform === "codeforces") codeforcesAssigned++;
      else leetcodeAssigned++;

      if (p.status === "solved") {
        solvedProblems++;
        solvedDates.add(session.date);
        if (p.platform === "codeforces") codeforcesSolved++;
        else leetcodeSolved++;
      } else if (p.status === "skipped") {
        skippedProblems++;
      }
    }
  }

  const completionRate =
    assignedProblems > 0
      ? Math.round((solvedProblems / assignedProblems) * 100)
      : 0;

  return {
    totalSessions: mine.length,
    solvedProblems,
    assignedProblems,
    skippedProblems,
    uniqueProblems: unique.size,
    codeforcesSolved,
    leetcodeSolved,
    codeforcesAssigned,
    leetcodeAssigned,
    activeDays,
    currentStreak: getStreak(mine, profileId),
    bestStreak: getBestStreak(mine, profileId),
    completionRate,
  };
}

export interface ConceptProgressSnapshot {
  concept: string;
  totalSolved: number;
  lastPracticed: string | null;
}

/**
 * Concept progress across history. How many times has each concept appeared
 * in solved roadmap problems, and when was it last solved?
 */
export function getConceptProgress(
  sessions: RoadmapSession[],
  profileId?: string
): ConceptProgressSnapshot[] {
  const mine = profileId
    ? sessions.filter((s) => s.profileId === profileId)
    : sessions;

  const map = new Map<string, { totalSolved: number; lastPracticed: string | null }>();

  for (const session of mine) {
    for (const p of session.problems) {
      if (p.status !== "solved") continue;
      const entry = map.get(p.concept) || { totalSolved: 0, lastPracticed: null };
      entry.totalSolved++;
      if (!entry.lastPracticed || session.date > entry.lastPracticed) {
        entry.lastPracticed = session.date;
      }
      map.set(p.concept, entry);
    }
  }

  return [...map.entries()]
    .map(([concept, data]) => ({ concept, ...data }))
    .sort((a, b) => b.totalSolved - a.totalSolved);
}

/** Convert a history problem status set into a simple per-day verdict. */
export function summarizeDay(session: RoadmapSession | undefined): {
  status: "rest" | "pending" | "partial" | "done";
  solved: number;
  scheduled: number;
} {
  if (!session || session.problems.length === 0) {
    return { status: "rest", solved: 0, scheduled: 0 };
  }
  const solved = session.problems.filter((p) => p.status === "solved").length;
  const scheduled = session.problems.length;
  if (solved === 0) return { status: "pending", solved, scheduled };
  if (solved === scheduled) return { status: "done", solved, scheduled };
  return { status: "partial", solved, scheduled };
}