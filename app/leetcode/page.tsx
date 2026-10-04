"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Layers,
  Trophy,
  TrendingUp,
  ExternalLink,
  BarChart3,
  CircleCheck,
} from "lucide-react";
import { useProfile } from "@/lib/use-profile";
import { DEMO_DATA } from "@/data/demo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import { TopicTags } from "@/components/ui/TopicTags";
import { ConceptSkill, RecommendationItem, PlatformAnalysis, LeetCodeProfile } from "@/types";
import { getPlatformAnalysis } from "@/lib/analyzer";

interface ApiAnalysis {
  leetcodeProfile: LeetCodeProfile | null;
  leetcodeAnalysis: PlatformAnalysis | null;
}

export default function LeetCodePage() {
  const { profile } = useProfile();
  const [data, setData] = useState<ApiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    if (profile.profileId === "demo") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData({
        leetcodeProfile: DEMO_DATA.leetcodeProfile,
        leetcodeAnalysis: getPlatformAnalysis(
          "demo",
          "leetcode",
          DEMO_DATA.conceptSkills,
          DEMO_DATA.recommendations,
          DEMO_DATA.blindSpots
        ),
      });
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/analysis?profileId=${profile.profileId}`);
        if (!res.ok) {
          const d = await res.json();
          setError(d.error || "Failed to load LeetCode analysis");
          return;
        }
        const d = await res.json();
        setData({
          leetcodeProfile: d.leetcodeProfile || null,
          leetcodeAnalysis: d.leetcodeAnalysis || null,
        });
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  const lcProfile = data?.leetcodeProfile;
  const analysis = data?.leetcodeAnalysis;

  const weakSkills = useMemo(
    () =>
      analysis
        ? [...analysis.weakConcepts].slice(0, 6)
        : [],
    [analysis]
  );

  const strongSkills = useMemo(
    () =>
      analysis
        ? [...analysis.strongConcepts].slice(0, 5)
        : [],
    [analysis]
  );

  const categoryMastery = useMemo(() => {
    if (!analysis) return [];
    return Object.entries(analysis.categoryMastery)
      .map(([name, mastery]) => ({ name, mastery }))
      .sort((a, b) => b.mastery - a.mastery)
      .slice(0, 8);
  }, [analysis]);

  const recs = analysis?.recommendations || [];

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-xl font-bold">No profile selected</h2>
        <p className="max-w-md text-muted-foreground">
          Analyze a profile first to see your LeetCode breakdown.
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
            href="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Layers className="text-primary" size={24} />
              LeetCode Analysis
            </h1>
            <p className="text-sm text-muted-foreground">
              Your LeetCode-only skill breakdown and problem picks.
            </p>
          </div>
        </div>
        <Link
          href="/roadmap?lc=1"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <TrendingUp size={16} />
          LC Weekly Roadmap
        </Link>
      </div>

      {loading && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-muted-foreground">Loading LeetCode analysis...</p>
        </div>
      )}

      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && (
        <>
          {!analysis ? (
            <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
              No LeetCode data for this profile yet. Link a LeetCode username on
              the{" "}
              <Link href="/" className="text-primary hover:underline">
                home page
              </Link>
              .
            </div>
          ) : (
            <>
              <ProfileHeader
                lcProfile={lcProfile ?? null}
                analysis={analysis}
              />

              <DifficultyBreakdown lcProfile={lcProfile ?? null} />

              <div className="grid gap-6 lg:grid-cols-2">
                <CategorySection categoryMastery={categoryMastery} />
                <StrongSection strongSkills={strongSkills} />
              </div>

              <WeakSection weakSkills={weakSkills} />

              <RecommendationsSection recommendations={recs} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function ProfileHeader({
  lcProfile,
  analysis,
}: {
  lcProfile: LeetCodeProfile | null;
  analysis: PlatformAnalysis;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Trophy size={16} className="text-amber-500" />
            LeetCode Solved
          </div>
          <p className="mt-3 text-3xl font-bold">
            {lcProfile?.totalSolved ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {lcProfile?.easySolved ?? 0}E · {lcProfile?.mediumSolved ?? 0}M ·{" "}
            {lcProfile?.hardSolved ?? 0}H
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BarChart3 size={16} className="text-violet-500" />
            Global Ranking
          </div>
          <p className="mt-3 text-2xl font-bold">
            {lcProfile?.ranking ? `#${lcProfile.ranking.toLocaleString()}` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {lcProfile?.username || "unknown"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CircleCheck size={16} className="text-blue-500" />
            Concepts Solved
          </div>
          <p className="mt-3 text-3xl font-bold">
            {analysis.conceptSkills.filter((s) => s.solvedCount > 0).length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            across {analysis.totalSolved || 0} problems
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp size={16} className="text-emerald-500" />
            LC Mastery
          </div>
          <p className="mt-3 text-3xl font-bold">{analysis.overallMastery}%</p>
          <div className="mt-2">
            <ProgressBar value={analysis.overallMastery} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DifficultyBreakdown({
  lcProfile,
}: {
  lcProfile: LeetCodeProfile | null;
}) {
  const easy = lcProfile?.easySolved ?? 0;
  const medium = lcProfile?.mediumSolved ?? 0;
  const hard = lcProfile?.hardSolved ?? 0;
  const total = easy + medium + hard;

  if (total === 0) return null;

  const segments = [
    { label: "Easy", count: easy, color: "bg-emerald-500" },
    { label: "Medium", count: medium, color: "bg-amber-500" },
    { label: "Hard", count: hard, color: "bg-red-500" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Difficulty Mix</CardTitle>
        <CardDescription>
          The distribution of everything you&apos;ve solved on LeetCode
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
          {segments.map((s) =>
            s.count > 0 ? (
              <div
                key={s.label}
                className={s.color}
                style={{ width: `${(s.count / total) * 100}%` }}
                title={`${s.label}: ${s.count}`}
              />
            ) : null
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {segments.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
              {s.label}: {s.count}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CategorySection({
  categoryMastery,
}: {
  categoryMastery: { name: string; mastery: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>LC Category Mastery</CardTitle>
        <CardDescription>
          Average mastery per DSA category on LeetCode
        </CardDescription>
      </CardHeader>
      <CardContent>
        {categoryMastery.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="space-y-3">
            {categoryMastery.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="font-medium">{c.mastery}%</span>
                </div>
                <ProgressBar value={c.mastery} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StrongSection({
  strongSkills,
}: {
  strongSkills: ConceptSkill[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Strong on LeetCode</CardTitle>
        <CardDescription>
          Concepts where you&apos;ve proven yourself on LC
        </CardDescription>
      </CardHeader>
      <CardContent>
        {strongSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keep practicing — once you reach 65%+ mastery in a concept it shows
            up here.
          </p>
        ) : (
          <div className="space-y-3">
            {strongSkills.map((s) => (
              <div key={s.concept}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{s.concept}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {s.solvedCount} solved
                    </span>
                    <StatusBadge status={s.status} />
                  </div>
                </div>
                <ProgressBar value={s.masteryScore} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WeakSection({ weakSkills }: { weakSkills: ConceptSkill[] }) {
  if (weakSkills.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weak on LeetCode</CardTitle>
        <CardDescription>
          Focus your LC practice here to round out your profile
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {weakSkills.map((s) => (
            <Link
              key={s.concept}
              href={`/concepts/${s.concept.toLowerCase().replace(/ /g, "-")}`}
              className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/50"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">{s.concept}</span>
                <StatusBadge status={s.status} />
              </div>
              <ProgressBar value={s.masteryScore} />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {s.solvedCount} solved on LC
              </p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationsSection({
  recommendations,
}: {
  recommendations: RecommendationItem[];
}) {
  if (recommendations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>LeetCode Recommendations</CardTitle>
            <CardDescription>
              Problems hand-picked for your LC profile
            </CardDescription>
          </div>
          <Link
            href="/roadmap"
            className="text-sm font-medium text-primary hover:underline"
          >
            Go to weekly roadmap →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {recommendations.slice(0, 6).map((rec) => (
            <div
              key={`${rec.problem.platform}-${rec.problem.externalId}`}
              className="rounded-lg border border-border p-4 transition-colors hover:border-primary/50"
            >
              <div className="mb-2 flex items-center justify-between">
                <Badge
                  variant={
                    rec.type === "learn"
                      ? "info"
                      : rec.type === "challenge"
                        ? "danger"
                        : "success"
                  }
                >
                  {rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}
                </Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  Match {rec.score}
                </span>
              </div>
              <p className="text-sm font-medium">{rec.problem.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <DifficultyBadge
                  platform="leetcode"
                  difficulty={rec.problem.difficulty}
                  rating={rec.problem.rating}
                />
                <Badge variant="muted">{rec.concept}</Badge>
                <TopicTags tags={rec.problem.tags} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{rec.reason}</p>
              <a
                href={rec.problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                Solve on LeetCode <ExternalLink size={12} />
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}