"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Code2,
  Trophy,
  TrendingUp,
  ExternalLink,
  Award,
  Layers,
} from "lucide-react";
import { useProfile } from "@/lib/use-profile";
import { DEMO_DATA } from "@/data/demo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import { TopicTags } from "@/components/ui/TopicTags";
import { ConceptSkill, RecommendationItem, PlatformAnalysis, CodeforcesProfile } from "@/types";
import { getPlatformAnalysis } from "@/lib/analyzer";

interface ApiAnalysis {
  codeforcesProfile: CodeforcesProfile | null;
  codeforcesAnalysis: PlatformAnalysis | null;
}

export default function CodeforcesPage() {
  const { profile } = useProfile();
  const [data, setData] = useState<ApiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    if (profile.profileId === "demo") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData({
        codeforcesProfile: DEMO_DATA.codeforcesProfile,
        codeforcesAnalysis: getPlatformAnalysis(
          "demo",
          "codeforces",
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
          setError(d.error || "Failed to load Codeforces analysis");
          return;
        }
        const d = await res.json();
        setData({
          codeforcesProfile: d.codeforcesProfile || null,
          codeforcesAnalysis: d.codeforcesAnalysis || null,
        });
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  const cfProfile = data?.codeforcesProfile;
  const analysis = data?.codeforcesAnalysis;

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
          Analyze a profile first to see your Codeforces breakdown.
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
              <Code2 className="text-primary" size={24} />
              Codeforces Analysis
            </h1>
            <p className="text-sm text-muted-foreground">
              Your Codeforces-only skill breakdown and problem picks.
            </p>
          </div>
        </div>
        <Link
          href="/roadmap?cf=1"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <TrendingUp size={16} />
          CF Weekly Roadmap
        </Link>
      </div>

      {loading && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-muted-foreground">Loading Codeforces analysis...</p>
        </div>
      )}

      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && (
        <>
          {!analysis ? (
            <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
              No Codeforces data for this profile yet. Link a Codeforces
              username on the{" "}
              <Link href="/" className="text-primary hover:underline">
                home page
              </Link>
              .
            </div>
          ) : (
            <>
              <ProfileHeader
                cfProfile={cfProfile ?? null}
                analysis={analysis}
              />

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
  cfProfile,
  analysis,
}: {
  cfProfile: CodeforcesProfile | null;
  analysis: PlatformAnalysis;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Trophy size={16} className="text-amber-500" />
            Codeforces Rating
          </div>
          <p className="mt-3 text-3xl font-bold">
            {cfProfile?.rating ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Max: {cfProfile?.maxRating ?? "—"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Award size={16} className="text-violet-500" />
            Rank
          </div>
          <p className="mt-3 text-2xl font-bold capitalize">
            {cfProfile?.rank?.replace(/-/g, " ") || "Unranked"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {cfProfile?.username || "unknown"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Layers size={16} className="text-blue-500" />
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
            CF Mastery
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

function CategorySection({
  categoryMastery,
}: {
  categoryMastery: { name: string; mastery: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>CF Category Mastery</CardTitle>
        <CardDescription>
          Average mastery per DSA category on Codeforces
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
        <CardTitle>Strong on Codeforces</CardTitle>
        <CardDescription>
          Concepts where you&apos;ve proven yourself on CF
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Weak on Codeforces</CardTitle>
            <CardDescription>
              Focus your CF practice here for the biggest rating gains
            </CardDescription>
          </div>
        </div>
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
                {s.solvedCount} solved on CF
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
            <CardTitle>Codeforces Recommendations</CardTitle>
            <CardDescription>
              Problems hand-picked for your CF profile
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
                  platform="codeforces"
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
                Solve on Codeforces <ExternalLink size={12} />
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}