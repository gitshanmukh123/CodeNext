"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Map,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  Circle,
  SkipForward,
  Shuffle,
  Flame,
  History,
  TrendingUp,
  Trophy,
  Route,
  Flag,
  CalendarDays,
} from "lucide-react";
import { useProfile } from "@/lib/use-profile";
import {
  useRoadmapHistory,
  getStreak,
  getBestStreak,
  getTodayKey,
  HistoryProblem,
  ProblemStatus,
} from "@/lib/roadmap-history";
import {
  useWeeklyRoadmap,
  getWeekStart,
  formatWeekLabel,
  buildWeeklyEntry,
  WeekProblemStatus,
  WeeklyRoadmapProblem,
} from "@/lib/weekly-roadmap";
import {
  RecommendationItem,
  ConceptSkill,
  ConceptProgression,
  Platform,
} from "@/types";
import { DEMO_DATA } from "@/data/demo";
import { generateWeeklyPlan, buildConceptProgression } from "@/lib/recommender";
import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import { TopicTags } from "@/components/ui/TopicTags";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface RoadmapPayload {
  recommendations: RecommendationItem[];
  conceptSkills: ConceptSkill[];
  progression: ConceptProgression[];
  platform?: Platform | null;
}

function toHistoryProblem(
  p: WeeklyRoadmapProblem,
  status: ProblemStatus
): HistoryProblem {
  return {
    key: p.key,
    title: p.title,
    platform: p.platform,
    concept: p.concept,
    difficulty: p.difficulty,
    rating: p.rating,
    url: p.url,
    status,
    source: "weekly",
  };
}

export default function RoadmapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <p className="text-muted-foreground">Loading weekly roadmap...</p>
        </div>
      }
    >
      <RoadmapContent />
    </Suspense>
  );
}

function RoadmapContent() {
  const { profile } = useProfile();
  const history = useRoadmapHistory(profile?.profileId);
  const searchParams = useSearchParams();

  // Support /roadmap?cf=1 and /roadmap?lc=1 for platform-specific roadmaps.
  const platformFilter =
    searchParams.get("cf") === "1"
      ? ("codeforces" as Platform)
      : searchParams.get("lc") === "1"
        ? ("leetcode" as Platform)
        : null;

  const weekStart = getWeekStart();
  const weekly = useWeeklyRoadmap(profile?.profileId, weekStart, platformFilter);

  const [payload, setPayload] = useState<RoadmapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const storedEntry = weekly.entry;
  const saveWeek = weekly.saveWeek;

  const initializingRef = useRef(false);

  // Load the payload once per profile/platform change.
  useEffect(() => {
    if (!profile) return;

    if (profile.profileId === "demo") {
      const recs = platformFilter
        ? DEMO_DATA.recommendations.filter(
            (r) => r.problem.platform === platformFilter
          )
        : DEMO_DATA.recommendations;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPayload({
        recommendations: recs,
        conceptSkills: DEMO_DATA.conceptSkills,
        progression: buildConceptProgression(DEMO_DATA.conceptSkills),
        platform: platformFilter,
      });
      setLoading(false);
      return;
    }

    const fetchRoadmap = async () => {
      try {
        const qp = new URLSearchParams({ profileId: profile.profileId });
        if (platformFilter) qp.set("platform", platformFilter);
        const res = await fetch(`/api/roadmap?${qp.toString()}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load roadmap");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setPayload({
          recommendations: data.recommendations || [],
          conceptSkills: data.conceptSkills || [],
          progression: data.progression || [],
          platform: (data.platform as Platform) || platformFilter,
        });
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchRoadmap();
  }, [profile, platformFilter]);

  // (Re)build this week's plan exactly once, then persist it. If a stored
  // plan for the SAME week + platform exists, restore it (progress kept).
  useEffect(() => {
    if (!payload || !profile) return;
    if (payload.recommendations.length === 0) return;

    if (
      storedEntry &&
      storedEntry.weekStart === weekStart &&
      (storedEntry.platform || null) === (platformFilter || null)
    ) {
      return;
    }

    if (initializingRef.current) return;
    initializingRef.current = true;

    const w = generateWeeklyPlan(payload.conceptSkills, payload.recommendations, {
      excludeProblemIds: history.seenProblemIds,
      platform: platformFilter || undefined,
    });
    const entry = buildWeeklyEntry(
      profile.profileId,
      w.startDate,
      platformFilter,
      w.days
    );
    saveWeek(entry);
    initializingRef.current = false;
  }, [
    payload,
    profile,
    weekStart,
    platformFilter,
    storedEntry,
    history.seenProblemIds,
    saveWeek,
  ]);

  const statusOf = (p: WeeklyRoadmapProblem): WeekProblemStatus => p.status;

  const todayKey = getTodayKey();
  const todayName = new Date(todayKey + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });
  const todayDay = weekly.entry?.days.find((d) => d.day === todayName);

  const solvedThisWeek = weekly.solvedCount;
  const scheduledThisWeek = weekly.totalCount;

  const streak = getStreak(history.sessions, profile?.profileId);
  const bestStreak = getBestStreak(history.sessions, profile?.profileId);

  // Keep streak/history in sync when a roadmap problem changes status.
  // Marking solved/skipped records it in today's session; undoing a mark
  // downgrades it back to pending so stats and streaks never over-count.
  const toggleSolved = (p: WeeklyRoadmapProblem) => {
    if (!profile) return;
    const next: WeekProblemStatus =
      p.status === "solved" ? "pending" : "solved";
    weekly.setStatus(p.key, next);
    if (next === "solved") {
      history.ensureSession(todayKey, [toHistoryProblem(p, "solved")]);
    } else {
      history.setStatus(todayKey, p.key, "pending");
    }
  };

  const skipProblem = (p: WeeklyRoadmapProblem) => {
    if (!profile) return;
    // Skipped problems should NOT be recommended again this week.
    const next: WeekProblemStatus =
      p.status === "skipped" ? "pending" : "skipped";
    weekly.setStatus(p.key, next);
    if (next === "skipped") {
      history.ensureSession(todayKey, [toHistoryProblem(p, "skipped")]);
    } else {
      history.setStatus(todayKey, p.key, "pending");
    }
  };

  const regenerateWeek = useCallback(() => {
    if (!payload || !profile) return;
    const seen = new Set(history.seenProblemIds);
    for (const p of weekly.allProblems) {
      if (p.status === "solved" || p.status === "skipped") {
        seen.add(p.key);
      }
    }

    const w = generateWeeklyPlan(payload.conceptSkills, payload.recommendations, {
      excludeProblemIds: seen,
      platform: platformFilter || undefined,
    });
    const entry = buildWeeklyEntry(
      profile.profileId,
      w.startDate,
      platformFilter,
      w.days
    );
    weekly.saveWeek(entry);
  }, [payload, profile, weekly, history.seenProblemIds, platformFilter]);

  const progression = payload?.progression || [];

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-xl font-bold">No profile selected</h2>
        <p className="max-w-md text-muted-foreground">
          Analyze a profile first to see your personalized weekly roadmap.
        </p>
        <Link
          href="/"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Analyze a Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Map className="text-primary" size={24} />
              Weekly Roadmap
            </h1>
            <p className="text-sm text-muted-foreground">
              {platformFilter === "codeforces"
                ? "A Codeforces-focused week."
                : platformFilter === "leetcode"
                  ? "A LeetCode-focused week."
                  : "A mixed Codeforces + LeetCode week that never repeats a problem."}{" "}
              Progress is saved on this device and restored all week long.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {platformFilter && (
            <Link
              href="/roadmap"
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Shuffle size={16} />
              Mixed
            </Link>
          )}
          <button
            onClick={regenerateWeek}
            disabled={!payload?.recommendations || payload.recommendations.length < 2}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            title="Rebuild the week from fresh problems (keeps solved/skipped hidden)"
          >
            <Shuffle size={16} />
            Regenerate week
          </button>
          <Link
            href="/history"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <History size={16} />
            Roadmap History
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-muted-foreground">Building your weekly roadmap...</p>
        </div>
      )}

      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && !weekly.entry && (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 rounded-lg border border-border p-6 text-center">
          <p className="text-xl font-semibold">
            No problems to schedule this week
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {platformFilter
              ? `We couldn't find recommendations for ${platformFilter === "codeforces" ? "Codeforces" : "LeetCode"}.`
              : "We couldn't find enough recommendations to build a week."}{" "}
            Run a fresh analysis or connect a platform to unlock your weekly
            roadmap.
          </p>
          <Link
            href="/"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Analyze a Profile
          </Link>
        </div>
      )}

      {weekly.entry && (
        <>
          <StatsRow
            streak={streak}
            bestStreak={bestStreak}
            solvedThisWeek={solvedThisWeek}
            scheduledThisWeek={scheduledThisWeek}
            weekLabel={formatWeekLabel(weekly.entry.weekStart)}
            completionPct={weekly.completionPct}
          />

          {todayDay && (
            <TodayCard
              day={todayDay}
              statusOf={statusOf}
              onToggleSolved={toggleSolved}
              onSkip={skipProblem}
            />
          )}

          <Week2DayStrip
            entry={weekly.entry}
            todayName={todayName}
          />

          <WeeklyPlanSection
            entry={weekly.entry}
            todayName={todayName}
            statusOf={statusOf}
            onToggleSolved={toggleSolved}
            onSkip={skipProblem}
          />
        </>
      )}

      {progression.length > 0 && (
        <LearningPathSection progression={progression} />
      )}
    </div>
  );
}

function StatsRow({
  streak,
  bestStreak,
  solvedThisWeek,
  scheduledThisWeek,
  weekLabel,
  completionPct,
}: {
  streak: number;
  bestStreak: number;
  solvedThisWeek: number;
  scheduledThisWeek: number;
  weekLabel: string;
  completionPct: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Flame size={16} className="text-orange-500" />
            Current Streak
          </div>
          <p className="mt-3 text-3xl font-bold">{streak}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {streak === 0
              ? "Solve one problem today to ignite it"
              : "consecutive days with a solved problem"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Trophy size={16} className="text-amber-500" />
            Best Streak
          </div>
          <p className="mt-3 text-3xl font-bold">{bestStreak}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            longest run you&apos;ve logged
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CheckCircle2 size={16} className="text-emerald-500" />
            Solved This Week
          </div>
          <p className="mt-3 text-3xl font-bold">
            {solvedThisWeek}
            <span className="text-lg text-muted-foreground">
              {" "}
              / {scheduledThisWeek}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{weekLabel}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp size={16} className="text-blue-500" />
            Week Completion
          </div>
          <p className="mt-3 text-3xl font-bold">{completionPct}%</p>
          <div className="mt-2">
            <ProgressBar value={completionPct} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TodayCard({
  day,
  statusOf,
  onToggleSolved,
  onSkip,
}: {
  day: { day: string; theme: string; date: string; problems: WeeklyRoadmapProblem[] };
  statusOf: (p: WeeklyRoadmapProblem) => WeekProblemStatus;
  onToggleSolved: (p: WeeklyRoadmapProblem) => void;
  onSkip: (p: WeeklyRoadmapProblem) => void;
}) {
  const done = day.problems.filter((p) => statusOf(p) === "solved").length;

  return (
    <Card className="border-primary/60 ring-1 ring-primary/30">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-primary" />
            <div>
              <CardTitle>Today — {day.day}</CardTitle>
              <CardDescription>
                {day.theme} ·{" "}
                {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </CardDescription>
            </div>
          </div>
          <Badge variant="info">
            {done}/{day.problems.length || 0} done today
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {day.problems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Rest / review day — revisit your weak concepts.
          </p>
        ) : (
          <ol className="space-y-2">
            {day.problems.map((p) => {
              const status = statusOf(p);
              const doneP = status === "solved";
              return (
                <li
                  key={p.key}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    doneP
                      ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-900/10"
                      : "border-border"
                  }`}
                >
                  <button
                    onClick={() => onToggleSolved(p)}
                    aria-label={doneP ? "Mark as not solved" : "Mark as solved"}
                    className="mt-0.5 shrink-0"
                  >
                    {doneP ? (
                      <CheckCircle2 size={22} className="text-emerald-500" />
                    ) : (
                      <Circle
                        size={22}
                        className="text-muted-foreground transition-colors hover:text-primary"
                      />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className={`font-medium ${doneP ? "line-through opacity-60" : ""}`}
                      >
                        {p.title}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <DifficultyBadge
                          platform={p.platform}
                          difficulty={p.difficulty}
                          rating={p.rating}
                        />
                        <Badge
                          variant={
                            p.platform === "codeforces" ? "info" : "success"
                          }
                        >
                          {p.platform === "codeforces" ? "CF" : "LC"}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="info">{p.concept}</Badge>
                      <TopicTags tags={p.tags} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        Open problem <ExternalLink size={12} />
                      </a>
                      {status !== "skipped" ? (
                        <button
                          onClick={() => onSkip(p)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          title="Skip and never recommend this again"
                        >
                          <SkipForward size={12} />
                          Skip
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Skipped — won&apos;t reappear this week
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function Week2DayStrip({
  entry,
  todayName,
}: {
  entry: {
    weekStart: string;
    days: { day: string; date: string; problems: WeeklyRoadmapProblem[] }[];
  };
  todayName: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Week at a glance</CardTitle>
          <Badge variant="muted">{formatWeekLabel(entry.weekStart)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
          {entry.days.map((day) => {
            const isToday = day.day === todayName;
            const pct =
              day.problems.length > 0
                ? Math.round(
                    (day.problems.filter((p) => p.status === "solved").length /
                      day.problems.length) *
                      100
                  )
                : 0;
            return (
              <div
                key={day.day}
                className={`rounded-lg border p-2 text-center ${
                  isToday ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <p className="text-[10px] font-medium text-muted-foreground">
                  {day.day.slice(0, 3)}
                </p>
                <p className="mt-0.5 text-xs font-semibold">
                  {new Date(day.date + "T00:00:00").getDate()}
                </p>
                {day.problems.length === 0 ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">Rest</p>
                ) : (
                  <ProgressBar value={pct} className="mt-1.5 h-1" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyPlanSection({
  entry,
  todayName,
  statusOf,
  onToggleSolved,
  onSkip,
}: {
  entry: {
    days: {
      day: string;
      date: string;
      theme: string;
      problems: WeeklyRoadmapProblem[];
    }[];
  };
  todayName: string;
  statusOf: (p: WeeklyRoadmapProblem) => WeekProblemStatus;
  onToggleSolved: (p: WeeklyRoadmapProblem) => void;
  onSkip: (p: WeeklyRoadmapProblem) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Daily Breakdown</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {entry.days.map((day) => {
          const isToday = day.day === todayName;
          const done = day.problems.filter((p) => p.status === "solved").length;
          const skipped = day.problems.filter(
            (p) => p.status === "skipped"
          ).length;

          return (
            <Card
              key={day.day}
              className={
                isToday ? "border-primary/60 ring-1 ring-primary/30" : ""
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {day.day}
                    {isToday && (
                      <Badge variant="info" className="ml-2">
                        Today
                      </Badge>
                    )}
                  </CardTitle>
                  <Badge variant="muted">
                    {done}/{day.problems.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="info">{day.theme}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(day.date + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" }
                    )}
                  </span>
                  {skipped > 0 && (
                    <span className="text-xs text-muted-foreground">
                      · {skipped} skipped
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {day.problems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Rest / review day — revisit weak concepts.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {day.problems.map((p) => {
                      const status = statusOf(p);
                      const doneP = status === "solved";
                      const skippedP = status === "skipped";
                      return (
                        <div
                          key={p.key}
                          className={`rounded-md border p-2.5 ${
                            doneP
                              ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-900/10"
                              : skippedP
                                ? "border-muted bg-muted/30 opacity-70"
                                : "border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-2">
                              <button
                                onClick={() => onToggleSolved(p)}
                                aria-label={
                                  doneP ? "Mark as not solved" : "Mark as solved"
                                }
                                className="mt-0.5 shrink-0"
                              >
                                {doneP ? (
                                  <CheckCircle2
                                    size={16}
                                    className="text-emerald-500"
                                  />
                                ) : (
                                  <Circle
                                    size={16}
                                    className="text-muted-foreground hover:text-primary"
                                  />
                                )}
                              </button>
                              <p
                                className={`text-sm font-medium ${
                                  doneP ? "line-through opacity-60" : ""
                                }`}
                              >
                                {p.title}
                              </p>
                            </div>
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-xs text-primary hover:underline"
                            >
                              Open →
                            </a>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <DifficultyBadge
                              platform={p.platform}
                              difficulty={p.difficulty}
                              rating={p.rating}
                            />
                            <Badge
                              variant={
                                p.platform === "codeforces" ? "info" : "success"
                              }
                            >
                              {p.platform === "codeforces" ? "CF" : "LC"}
                            </Badge>
                            <Badge variant="muted">
                              {p.type.charAt(0).toUpperCase() + p.type.slice(1)}
                            </Badge>
                            {skippedP && (
                              <button
                                onClick={() => onSkip(p)}
                                className="text-xs text-muted-foreground underline hover:text-foreground"
                                title="Undo skip"
                              >
                                undo
                              </button>
                            )}
                            {!skippedP && (
                              <button
                                onClick={() => onSkip(p)}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                title="Skip — won't reappear this week"
                              >
                                <SkipForward size={11} />
                                Skip
                              </button>
                            )}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge variant="info">{p.concept}</Badge>
                            <TopicTags tags={p.tags} max={2} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The "what to learn next" path. Concepts are ordered by readiness first
 * (prerequisites met), then weakness. Blocked concepts show what's standing
 * in the way so the user always knows WHY they aren't first.
 */
function LearningPathSection({
  progression,
}: {
  progression: ConceptProgression[];
}) {
  const nextUp = progression.filter(
    (p) => p.status === "Unexplored" || p.status === "Weak"
  );
  const developing = progression.filter((p) => p.status === "Developing");
  const strong = progression.filter((p) => p.status === "Strong");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Route size={20} className="text-primary" />
          <div>
            <CardTitle>Learning Path</CardTitle>
            <CardDescription>
              Ordered by readiness and weakness — master the top first, then
              work down.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {nextUp.length > 0 && (
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold capitalize text-foreground">
                <Flag size={15} className="text-red-500" />
                Next up ({nextUp.length})
              </h4>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {nextUp.slice(0, 6).map((p) => (
                  <ProgressionCard key={p.concept} p={p} />
                ))}
              </div>
            </div>
          )}

          {developing.length > 0 && (
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <TrendingUp size={15} className="text-amber-500" />
                In progress ({developing.length})
              </h4>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {developing.slice(0, 3).map((p) => (
                  <ProgressionCard key={p.concept} p={p} />
                ))}
              </div>
            </div>
          )}

          {strong.length > 0 && (
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Trophy size={15} className="text-emerald-500" />
                Mastered ({strong.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {strong.slice(0, 8).map((p) => (
                  <Badge key={p.concept} variant="success">
                    {p.concept}
                  </Badge>
                ))}
                {strong.length > 8 && (
                  <Badge variant="muted">+{strong.length - 8} more</Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressionCard({ p }: { p: ConceptProgression }) {
  const blocked = !p.prerequisitesMet && p.prerequisites.length > 0;

  return (
    <Link
      href={`/concepts/${p.concept.toLowerCase().replace(/ /g, "-")}`}
      className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/50"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{p.concept}</span>
        <StatusBadge status={p.status} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex-1">
          <ProgressBar value={p.masteryScore} />
        </span>
        <span className="text-xs font-semibold">{p.masteryScore}%</span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {p.cfSolved > 0 && <span>CF {p.cfSolved} · </span>}
        {p.lcSolved > 0 && <span>LC {p.lcSolved} · </span>}
        {p.solvedCount} total solved
      </p>
      {blocked && (
        <p className="mt-2 rounded bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
          Unlocks when: {p.prerequisites.join(", ")}
        </p>
      )}
    </Link>
  );
}