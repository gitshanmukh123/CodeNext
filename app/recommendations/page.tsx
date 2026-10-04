"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Target,
  ArrowLeft,
  ExternalLink,
  Code2,
  Layers,
  List,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { useProfile } from "@/lib/use-profile";
import { useRoadmapHistory } from "@/lib/roadmap-history";
import { DEMO_DATA } from "@/data/demo";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import { TopicTags } from "@/components/ui/TopicTags";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";

interface RecDisplay {
  key: string;
  title: string;
  concept: string;
  type: string;
  score: number;
  reason: string;
  platform: string;
  difficulty: string;
  rating?: number;
  tags: string[];
  url: string;
}

interface ApiRecommendation {
  id?: string;
  score: number;
  reason: string;
  concept: string;
  type: string;
  problem?: {
    title: string;
    platform: string;
    difficulty: string;
    rating: number;
    url: string;
    externalId?: string;
    tags?: string[];
    concepts: string[];
  } | null;
}

type Tab = "all" | "codeforces" | "leetcode";

/**
 * Keys use the same `platform:externalId` format as getProblemKey() so the
 * "practice new problems" exclusions (from the local history) line up exactly
 * with the keys rendered here. Index suffixes are avoided on purpose.
 */
function toRecDisplay(r: ApiRecommendation): RecDisplay {
  const platform = r.problem?.platform || "unknown";
  const externalId = r.problem?.externalId || r.problem?.title || "unknown";
  return {
    key: `${platform}:${externalId}`,
    title: r.problem?.title || "Unknown problem",
    concept: r.concept,
    type: r.type,
    score: r.score,
    reason: r.reason,
    platform,
    difficulty: r.problem?.difficulty || "unknown",
    rating: r.problem?.rating || undefined,
    tags: r.problem?.tags || [],
    url: r.problem?.url || "",
  };
}

function dedupeRecs(recs: RecDisplay[]): RecDisplay[] {
  const seen = new Map<string, RecDisplay>();
  for (const r of recs) {
    const existing = seen.get(r.key);
    if (!existing || existing.score < r.score) seen.set(r.key, r);
  }
  return [...seen.values()];
}

export default function RecommendationsPage() {
  const { profile } = useProfile();
  const roadmapHistory = useRoadmapHistory(profile?.profileId);
  const [allRecommendations, setAllRecommendations] = useState<RecDisplay[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshMsg, setFreshMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (profile.profileId === "demo") {
      const mapped = dedupeRecs(
        DEMO_DATA.recommendations.map((r) =>
          toRecDisplay({
            score: r.score,
            reason: r.reason,
            concept: r.concept,
            type: r.type,
            problem: {
              title: r.problem.title,
              platform: r.problem.platform,
              difficulty: r.problem.difficulty || "unknown",
              rating: r.problem.rating || 0,
              url: r.problem.url,
              tags: r.problem.tags || [],
              concepts: r.problem.concepts,
              externalId: r.problem.externalId,
            },
          })
        )
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAllRecommendations(mapped);
      setLoading(false);
      return;
    }

    const fetchRecs = async (platform?: string) => {
      try {
        const qp = new URLSearchParams({ profileId: profile.profileId, limit: "40" });
        if (platform && platform !== "all") qp.set("platform", platform);
        const res = await fetch(`/api/recommendations?${qp.toString()}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load recommendations");
          return;
        }
        const data = await res.json();
        setAllRecommendations(
          dedupeRecs(
            ((data.recommendations || []) as ApiRecommendation[]).map(toRecDisplay)
          )
        );
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchRecs();
  }, [profile]);

  // Client-side platform filtering so tab changes never re-fetch.
  const visible = useMemo(
    () =>
      allRecommendations.filter(
        (r) => activeTab === "all" || r.platform === activeTab
      ),
    [allRecommendations, activeTab]
  );

  const refresh = async () => {
    if (!profile || profile.profileId === "demo") return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.profileId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to refresh");
        return;
      }
      setError(null);
      setFreshMsg(null);
      const qp = new URLSearchParams({ profileId: profile.profileId, limit: "40" });
      const recRes = await fetch(`/api/recommendations?${qp.toString()}`);
      const recData = await recRes.json();
      setAllRecommendations(
        dedupeRecs(
          ((recData.recommendations || []) as ApiRecommendation[]).map(toRecDisplay)
        )
      );
    } catch {
      setError("Something went wrong");
    } finally {
      setRefreshing(false);
    }
  };

  // Ask the recommender for a brand-new batch, excluding EVERY problem this
  // profile has ever completed (all-time) plus whatever is on screen right
  // now, so there are no repeats at all.
  const fetchFresh = async () => {
    if (!profile || profile.profileId === "demo") return;
    setRefreshing(true);
    try {
      const exclude = new Set(roadmapHistory.completedProblemIds);
      for (const r of allRecommendations) exclude.add(r.key);
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profile.profileId,
          platform: activeTab === "all" ? undefined : activeTab,
          excludeProblemIds: [...exclude],
          limit: 40,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load fresh problems");
        return;
      }
      const data = await res.json();
      setError(null);
      const fresh = dedupeRecs(
        ((data.recommendations || []) as ApiRecommendation[]).map(toRecDisplay)
      );
      setAllRecommendations(fresh);
      setFreshMsg(
        fresh.length === 0
          ? "Practice pool exhausted — every recommended problem has been tried or skipped. Re-analyze your profile to surface new material."
          : null
      );
    } catch {
      setError("Something went wrong");
    } finally {
      setRefreshing(false);
    }
  };

  const counts = useMemo(
    () => ({
      all: allRecommendations.length,
      codeforces: allRecommendations.filter((r) => r.platform === "codeforces").length,
      leetcode: allRecommendations.filter((r) => r.platform === "leetcode").length,
    }),
    [allRecommendations]
  );

  if (!profile) {
    return <EmptyState />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
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
              <Target className="text-primary" size={24} />
              Recommended Problems
            </h1>
            <p className="text-sm text-muted-foreground">
              Personalized picks ranked by your concept gaps, difficulty fit, and
              prerequisites. Filter by platform to focus your practice.
            </p>
          </div>
        </div>
        {profile.profileId !== "demo" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchFresh}
              disabled={
                refreshing || allRecommendations.length === 0 || loading
              }
              title="Excludes every problem you've completed or been recommended"
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles size={15} className={refreshing ? "animate-pulse" : ""} />
              Practice new problems
            </button>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              Re-analyze profile
            </button>
          </div>
        )}
      </div>

      <TabBar
        active={activeTab}
        onChange={setActiveTab}
        counts={counts}
      />

      {loading && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-muted-foreground">Loading recommendations...</p>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </p>
      )}

      {freshMsg && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          {freshMsg}
        </p>
      )}

      {!loading && !error && visible.length === 0 && (
        <NoRecommendations
          tab={activeTab}
          connectedCF={!!profile.codeforcesUsername}
          connectedLC={!!profile.leetcodeUsername}
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <>
          <MixBar recommendations={visible} />
          <TypeLegend recommendations={visible} />
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((rec, i) => (
              <RecCard key={rec.key} rec={rec} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TabBar({
  active,
  onChange,
  counts,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  counts: Record<Tab, number>;
}) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: "All Platforms", icon: <List size={15} /> },
    { id: "codeforces", label: "Codeforces", icon: <Code2 size={15} /> },
    { id: "leetcode", label: "LeetCode", icon: <Layers size={15} /> },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((tab) => {
        const Icon = () => tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              active === tab.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted"
            )}
          >
            <Icon />
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                active === tab.id
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {counts[tab.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MixBar({ recommendations }: { recommendations: RecDisplay[] }) {
  const cf = recommendations.filter((r) => r.platform === "codeforces").length;
  const lc = recommendations.filter((r) => r.platform === "leetcode").length;
  const easy = recommendations.filter((r) => r.difficulty === "easy").length;
  const medium = recommendations.filter((r) => r.difficulty === "medium").length;
  const hard = recommendations.filter((r) => r.difficulty === "hard").length;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
      <span className="font-medium text-muted-foreground">Pool snapshot:</span>
      <Badge variant="info">{cf} Codeforces</Badge>
      <Badge variant="success">{lc} LeetCode</Badge>
      <Badge variant="warning">{easy} Easy</Badge>
      <Badge variant="muted">{medium} Medium</Badge>
      <Badge variant="danger">{hard} Hard</Badge>
    </div>
  );
}

const TYPE_META: Record<string, { label: string; variant: "info" | "danger" | "warning" | "success" }> = {
  learn: { label: "Learn", variant: "info" },
  challenge: { label: "Challenge", variant: "danger" },
  reinforce: { label: "Reinforce", variant: "warning" },
  practice: { label: "Practice", variant: "success" },
};

function TypeLegend({ recommendations }: { recommendations: RecDisplay[] }) {
  const counts = recommendations.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-wrap items-center gap-2">
      {Object.entries(TYPE_META).map(([type, meta]) => {
        const count = counts[type] || 0;
        if (count === 0) return null;
        return (
          <Badge key={type} variant={meta.variant}>
            {meta.label} · {count}
          </Badge>
        );
      })}
    </div>
  );
}

function NoRecommendations({
  tab,
  connectedCF,
  connectedLC,
}: {
  tab: Tab;
  connectedCF: boolean;
  connectedLC: boolean;
}) {
  const platformName =
    tab === "codeforces" ? "Codeforces" : tab === "leetcode" ? "LeetCode" : null;
  const isConnected =
    tab === "codeforces" ? connectedCF : tab === "leetcode" ? connectedLC : true;

  return (
    <div className="rounded-lg border border-border p-8 text-center">
      <CheckCircle2 className="mx-auto mb-3 text-4xl text-primary" />
      <h2 className="text-lg font-semibold">
        {platformName
          ? `No ${platformName} recommendations left`
          : "No recommendations yet"}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {platformName && isConnected
          ? `Every unsolved ${platformName} problem in your profile has already been recommended. Re-analyze to pick up problem-solving difficulty you've since unlocked, or switch tabs to see picks from the other platform.`
          : platformName && !isConnected
            ? `You haven't connected a ${platformName} username yet. Add it in the analysis step to get platform-specific picks.`
            : "Analyze your profile to generate personalized recommendations."}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Link
          href={tab === "all" ? "/" : "/"}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Sparkles size={15} />
          Analyze a Profile
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

function RecCard({ rec, index }: { rec: RecDisplay; index: number }) {
  const typeMeta = TYPE_META[rec.type] || { label: rec.type, variant: "info" as const };
  const confidence = Math.max(Math.min(Math.round((rec.score / 100) * 100), 99), 5);

  return (
    <Card className="flex flex-col p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Badge variant={typeMeta.variant}>
          {index + 1}. {typeMeta.label}
        </Badge>
        <span className="text-xs font-medium text-muted-foreground">
          Match {Math.round(rec.score)}
        </span>
      </div>

      <p className="font-semibold">{rec.title}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <DifficultyBadge
          platform={rec.platform}
          difficulty={rec.difficulty}
          rating={rec.rating}
        />
        <Badge variant={rec.platform === "codeforces" ? "info" : "success"}>
          {rec.platform === "codeforces" ? "Codeforces" : "LeetCode"}
        </Badge>
        <Badge variant="muted">{rec.concept}</Badge>
        <TopicTags tags={rec.tags} />
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{rec.reason}</p>

      <div className="mt-auto">
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Match strength
          </span>
          <span className="flex-1">
            <ProgressBar value={confidence} className="h-1.5" />
          </span>
          <span className="text-xs font-semibold">{confidence}%</span>
        </div>

        {rec.url && (
          <a
            href={rec.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            Solve on {rec.platform === "codeforces" ? "Codeforces" : "LeetCode"}{" "}
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-xl font-bold">No profile selected</h2>
      <p className="max-w-md text-muted-foreground">
        Analyze a profile first to see personalized recommendations.
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