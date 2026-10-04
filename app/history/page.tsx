"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  History,
  Flame,
  Trophy,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  Layers,
  Code2,
  PieChart,
} from "lucide-react";
import { useProfile } from "@/lib/use-profile";
import {
  useRoadmapHistory,
  getTodayKey,
  getHistoryStats,
  getConceptProgress,
  summarizeDay,
  HistoryProblem,
} from "@/lib/roadmap-history";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";

function dateLabel(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function problemSourceBadge(p: HistoryProblem) {
  return p.source === "weekly" ? (
    <Badge variant="muted">Week plan</Badge>
  ) : p.source === "shuffled" ? (
    <Badge variant="warning">Shuffled</Badge>
  ) : (
    <Badge variant="info">Daily</Badge>
  );
}

export default function HistoryPage() {
  const { profile } = useProfile();
  const { sessions, clearProfileHistory } = useRoadmapHistory(profile?.profileId);

  const stats = useMemo(
    () => getHistoryStats(sessions, profile?.profileId),
    [sessions, profile]
  );

  const conceptProgress = useMemo(
    () => getConceptProgress(sessions, profile?.profileId),
    [sessions, profile]
  );

  // Last 12 weeks of day grid, using the simple summarizeDay verdict.
  const calendar = useMemo(() => {
    const weeks: {
      date: string;
      summary: ReturnType<typeof summarizeDay>;
    }[][] = [];
    for (let w = 0; w < 12; w++) {
      const weekStart = new Date();
      weekStart.setDate(
        weekStart.getDate() - ((weekStart.getDay() + 6) % 7) - (11 - w) * 7
      );
      const days: { date: string; summary: ReturnType<typeof summarizeDay> }[] =
        [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + d);
        const key = day.toISOString().split("T")[0];
        if (key > getTodayKey()) break;
        const session = profile
          ? sessions.find(
              (s) => s.profileId === profile.profileId && s.date === key
            )
          : undefined;
        days.push({ date: key, summary: summarizeDay(session) });
      }
      weeks.push(days);
    }
    return weeks;
  }, [sessions, profile]);

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-xl font-bold">No profile selected</h2>
        <p className="max-w-md text-muted-foreground">
          Analyze a profile first to track your roadmap history.
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
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/roadmap"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <History className="text-primary" size={24} />
              Roadmap History
            </h1>
            <p className="text-sm text-muted-foreground">
              Every problem you&apos;ve been assigned and whether you solved it
              — stored locally in your browser.
            </p>
          </div>
        </div>
        <button
          onClick={clearProfileHistory}
          className="inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          <Trash2 size={16} />
          Clear history
        </button>
      </div>

      {profile.profileId === "demo" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <strong>Demo Mode:</strong> Your marks are stored locally and will
          reset if you switch profiles.
        </div>
      )}

      <StatsGrid stats={stats} />

      <ActivityCalendar calendar={calendar} />

      {conceptProgress.length > 0 && (
        <ConceptProgressSection conceptProgress={conceptProgress} />
      )}

      <SessionsSection sessions={sessions} />
    </div>
  );
}

function StatsGrid({
  stats,
}: {
  stats: ReturnType<typeof getHistoryStats>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Flame size={16} className="text-orange-500" />}
        label="Current Streak"
        value={`${stats.currentStreak} days`}
        sub="consecutive days with a solved problem"
      />
      <StatCard
        icon={<Trophy size={16} className="text-amber-500" />}
        label="Best Streak"
        value={`${stats.bestStreak} days`}
        sub="your longest run"
      />
      <StatCard
        icon={<CheckCircle2 size={16} className="text-emerald-500" />}
        label="Problems Solved"
        value={String(stats.solvedProblems)}
        sub={`${stats.codeforcesSolved} CF · ${stats.leetcodeSolved} LC`}
      />
      <StatCard
        icon={<PieChart size={16} className="text-blue-500" />}
        label="Completion Rate"
        value={`${stats.completionRate}%`}
        sub={`${stats.uniqueProblems} unique problems seen`}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-3 text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function ActivityCalendar({
  calendar,
}: {
  calendar: { date: string; summary: ReturnType<typeof summarizeDay> }[][];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Calendar</CardTitle>
        <CardDescription>
          Last 12 weeks. Green = fully solved, amber = partial, muted = assigned
          but pending, gray = no activity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {calendar.map((week, wi) => (
            <div key={wi} className="flex shrink-0 flex-col gap-1">
              <div className="flex gap-1">
                {week.map((day) => {
                  const s = day.summary;
                  const color =
                    s.status === "done"
                      ? "bg-emerald-500"
                      : s.status === "partial"
                        ? "bg-amber-400/70"
                        : s.status === "pending"
                          ? "bg-muted"
                          : "bg-muted/40";
                  const title = `${dateLabel(day.date)} · ${
                    s.status === "rest"
                      ? "rest"
                      : `${s.solved}/${s.scheduled} solved`
                  }`;
                  return (
                    <div
                      key={day.date}
                      title={title}
                      className={`h-3 w-3 rounded-sm ${color}`}
                    />
                  );
                })}
              </div>
              <p className="text-center text-[9px] text-muted-foreground">
                W{12 - wi}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-emerald-500" /> Fully solved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-amber-400/70" /> Partially
            solved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-muted" /> Assigned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-muted/40" /> No activity
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ConceptProgressSection({
  conceptProgress,
}: {
  conceptProgress: { concept: string; totalSolved: number; lastPracticed: string | null }[];
}) {
  const max = Math.max(...conceptProgress.map((c) => c.totalSolved), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Concept Progress</CardTitle>
        <CardDescription>
          The concepts you&apos;ve practiced most in your roadmap.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {conceptProgress.slice(0, 10).map((c) => (
            <div key={c.concept} className="rounded-lg border border-border p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">{c.concept}</span>
                <span className="text-xs text-muted-foreground">
                  {c.totalSolved} solved
                  {c.lastPracticed
                    ? ` · last ${new Date(
                        c.lastPracticed + "T00:00:00"
                      ).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : ""}
                </span>
              </div>
              <ProgressBar value={(c.totalSolved / max) * 100} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SessionsSection({
  sessions,
}: {
  sessions: ReturnType<typeof useRoadmapHistory>["sessions"];
}) {
  if (sessions.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Sessions</h2>
        <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
          No roadmap sessions yet. Visit the{" "}
          <Link href="/roadmap" className="text-primary hover:underline">
            Weekly Roadmap
          </Link>{" "}
          to get your plan and start tracking.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Sessions</h2>

      {sessions.map((session) => {
        const s = summarizeDay(session);
        const skipped = session.problems.filter(
          (p) => p.status === "skipped"
        ).length;
        const isToday = session.date === getTodayKey();
        const cfSolved = session.problems.filter(
          (p) => p.platform === "codeforces" && p.status === "solved"
        ).length;
        const lcSolved = session.problems.filter(
          (p) => p.platform === "leetcode" && p.status === "solved"
        ).length;

        return (
          <Card key={session.date} className={isToday ? "border-primary/60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle>{dateLabel(session.date)}</CardTitle>
                  {isToday && <Badge variant="info">Today</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 size={14} /> {s.solved} solved
                  </span>
                  <span className="flex items-center gap-1">
                    <Code2 size={14} className="text-blue-500" /> {cfSolved} CF
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers size={14} className="text-emerald-500" /> {lcSolved}{" "}
                    LC
                  </span>
                  {skipped > 0 && (
                    <span className="flex items-center gap-1 text-red-500">
                      <XCircle size={14} /> {skipped} skipped
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {s.status === "rest"
                    ? "Rest day"
                    : `${Math.round((s.solved / s.scheduled) * 100)}%`}
                </span>
                {s.status !== "rest" && (
                  <div className="flex-1">
                    <ProgressBar
                      value={
                        s.scheduled > 0
                          ? Math.round((s.solved / s.scheduled) * 100)
                          : 0
                      }
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {session.problems.map((p) => (
                  <div
                    key={`${session.date}-${p.key}`}
                    className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 ${
                      p.status === "solved"
                        ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-900/10"
                        : p.status === "skipped"
                          ? "opacity-60"
                          : "border-border"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`text-sm font-medium ${
                            p.status === "solved"
                              ? "line-through opacity-70"
                              : ""
                          }`}
                        >
                          {p.title}
                        </p>
                        {problemSourceBadge(p)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={p.platform === "codeforces" ? "info" : "success"}
                        >
                          {p.platform === "codeforces" ? "Codeforces" : "LeetCode"}
                        </Badge>
                        <DifficultyBadge
                          platform={p.platform}
                          difficulty={p.difficulty}
                          rating={p.rating}
                        />
                        <Badge variant="muted">{p.concept}</Badge>
                      </div>
                      {p.url && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Open <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    {p.status === "solved" && (
                      <Badge variant="success">Solved</Badge>
                    )}
                    {p.status === "skipped" && (
                      <Badge variant="muted">Skipped</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}