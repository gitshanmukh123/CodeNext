"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Target,
  TrendingUp,
  Activity,
  RefreshCw,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import { useProfile } from "@/lib/use-profile";
import {
  ConceptSkill,
  RecommendationItem,
  BlindSpot,
  CodeforcesProfile,
  LeetCodeProfile,
  DailyPlan,
} from "@/types";
import { DEMO_DATA } from "@/data/demo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge, PriorityBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SkillBarChart } from "@/components/charts/Charts";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import { TopicTags } from "@/components/ui/TopicTags";
import { generateDailyPlan } from "@/lib/recommender";

interface AnalysisResult {
  profileId: string;
  codeforcesProfile: CodeforcesProfile | null;
  leetcodeProfile: LeetCodeProfile | null;
  conceptSkills: ConceptSkill[];
  recommendations: RecommendationItem[];
  blindSpots: BlindSpot[];
  stats?: {
    totalProblems: number;
    totalSubmissions: number;
    solvedProblems: number;
  };
  errors?: string[];
  isDemo?: boolean;
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { saveProfile } = useProfile();
  const searchParams = useSearchParams();

  const codeforces = searchParams.get("codeforces");
  const leetcode = searchParams.get("leetcode");
  const demo = searchParams.get("demo") === "true";

  const runAnalysis = useCallback(
    async (cf: string, lc: string) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codeforcesUsername: cf,
            leetcodeUsername: lc,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Analysis failed");
          return;
        }

        setAnalysis(data);
        saveProfile({
          profileId: data.profileId,
          codeforcesUsername: cf || undefined,
          leetcodeUsername: lc || undefined,
          lastAnalyzed: new Date().toISOString(),
        });
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [saveProfile]
  );

  useEffect(() => {
    if (demo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnalysis({
        profileId: "demo",
        codeforcesProfile: DEMO_DATA.codeforcesProfile,
        leetcodeProfile: DEMO_DATA.leetcodeProfile,
        conceptSkills: DEMO_DATA.conceptSkills,
        recommendations: DEMO_DATA.recommendations,
        blindSpots: DEMO_DATA.blindSpots,
        isDemo: true,
      });
      saveProfile({
        profileId: "demo",
        codeforcesUsername: "tourist",
        leetcodeUsername: "demo_user",
        lastAnalyzed: new Date().toISOString(),
      });
      return;
    }

    if (codeforces || leetcode) {
      runAnalysis(codeforces || "", leetcode || "");
    }
  }, [codeforces, leetcode, demo, runAnalysis, saveProfile]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-bold text-foreground">Analysis Failed</h2>
        <p className="max-w-md text-muted-foreground">{error}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Trophy className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">No analysis yet</h2>
        <p className="max-w-md text-muted-foreground">
          Enter your Codeforces and LeetCode usernames from the home page to
          see your personalized analysis.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Analyze a Profile
        </Link>
      </div>
    );
  }

  const {
    codeforcesProfile,
    leetcodeProfile,
    conceptSkills,
    recommendations,
    blindSpots,
    isDemo,
  } = analysis;

  const overallMastery =
    conceptSkills.length > 0
      ? Math.round(
          conceptSkills.reduce((a, c) => a + c.masteryScore, 0) /
            conceptSkills.length
        )
      : 0;

  const weakConcepts = conceptSkills
    .filter((c) => c.status === "Weak")
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, 6);

  const strongConcepts = conceptSkills
    .filter((c) => c.status === "Strong")
    .sort((a, b) => b.masteryScore - a.masteryScore)
    .slice(0, 5);

  const categoryMastery: Record<string, number[]> = {};
  for (const c of conceptSkills) {
    if (!categoryMastery[c.category]) categoryMastery[c.category] = [];
    categoryMastery[c.category].push(c.masteryScore);
  }

  const topSkills = Object.entries(categoryMastery)
    .map(([name, scores]) => ({
      name,
      mastery: Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      ),
    }))
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 8);

  const todayPlan = generateDailyPlan(recommendations, {
    balancePlatforms: true,
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      {isDemo && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <strong>Demo Mode:</strong> You are viewing preloaded sample data. Use
          the home page to analyze a real profile.
        </div>
      )}

      {analysis.errors && analysis.errors.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <strong>Partial data:</strong>{" "}
          {analysis.errors.map((e, i) => (
            <span key={i}>
              {e}
              {i < (analysis.errors as string[]).length - 1 ? " | " : ""}
            </span>
          ))}
        </div>
      )}

      <ProfileOverview
        codeforcesProfile={codeforcesProfile}
        leetcodeProfile={leetcodeProfile}
        overallMastery={overallMastery}
      />

      <SkillOverview topSkills={topSkills} strongConcepts={strongConcepts} />

      <div className="grid gap-6 lg:grid-cols-2">
        <WeakConceptsSection weakConcepts={weakConcepts} />
        <BlindSpotsSection blindSpots={blindSpots} />
      </div>

      <RecommendationsSection recommendations={recommendations.slice(0, 5)} />

      <TodayPlanSection plan={todayPlan} />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
      <RefreshCw className="h-10 w-10 animate-spin text-primary" />
      <h2 className="text-lg font-semibold text-foreground">
        Analyzing your profile...
      </h2>
      <div className="flex max-w-lg flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
        <Badge variant="info">Fetching profiles</Badge>
        <Badge variant="info">Reading submissions</Badge>
        <Badge variant="info">Mapping concepts</Badge>
        <Badge variant="info">Measuring mastery</Badge>
        <Badge variant="info">Finding blind spots</Badge>
        <Badge variant="info">Recommending problems</Badge>
      </div>
    </div>
  );
}

function ProfileOverview({
  codeforcesProfile,
  leetcodeProfile,
  overallMastery,
}: {
  codeforcesProfile: CodeforcesProfile | null;
  leetcodeProfile: LeetCodeProfile | null;
  overallMastery: number;
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
            {codeforcesProfile?.rating ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Max: {codeforcesProfile?.maxRating ?? "—"} |{" "}
            {codeforcesProfile?.rank
              ? codeforcesProfile.rank.replace(/-/g, " ")
              : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Target size={16} className="text-emerald-500" />
            LeetCode Solved
          </div>
          <p className="mt-3 text-3xl font-bold">
            {leetcodeProfile?.totalSolved ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {leetcodeProfile?.easySolved ?? 0}E ·{" "}
            {leetcodeProfile?.mediumSolved ?? 0}M ·{" "}
            {leetcodeProfile?.hardSolved ?? 0}H
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp size={16} className="text-blue-500" />
            Overall DSA Mastery
          </div>
          <p className="mt-3 text-3xl font-bold">{overallMastery}%</p>
          <div className="mt-2">
            <ProgressBar value={overallMastery} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Activity size={16} className="text-violet-500" />
            Concepts Tracked
          </div>
          <p className="mt-3 text-3xl font-bold">
            {codeforcesProfile || leetcodeProfile ? "50+" : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Across all DSA categories
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SkillOverview({
  topSkills,
  strongConcepts,
}: {
  topSkills: { name: string; mastery: number }[];
  strongConcepts: ConceptSkill[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skill Overview</CardTitle>
        <CardDescription>
          Mastery across DSA categories — higher is better
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <SkillBarChart data={topSkills} />
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              Strongest Concepts
            </h4>
            {strongConcepts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No strong concepts yet. Keep practicing!
              </p>
            ) : (
              strongConcepts.map((c) => (
                <div key={c.concept}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{c.concept}</span>
                    <span className="font-medium">{c.masteryScore}%</span>
                  </div>
                  <ProgressBar value={c.masteryScore} />
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WeakConceptsSection({
  weakConcepts,
}: {
  weakConcepts: ConceptSkill[];
}) {
  if (weakConcepts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weak Concepts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Great job! No concepts are currently weak.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weak Concepts</CardTitle>
        <CardDescription>
          Focus on these first — they&apos;re where you&apos;ll improve fastest
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {weakConcepts.map((c) => (
            <Link
              key={c.concept}
              href={`/concepts/${c.concept.toLowerCase().replace(/ /g, "-")}`}
              className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/50"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">{c.concept}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {c.solvedCount} solved
                  </span>
                  <StatusBadge status={c.status} />
                </div>
              </div>
              <ProgressBar value={c.masteryScore} />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BlindSpotsSection({
  blindSpots,
}: {
  blindSpots: BlindSpot[];
}) {
  if (blindSpots.length === 0) return null;

  const critical = blindSpots.filter((b) => b.priority === "Critical").slice(0, 2);
  const high = blindSpots.filter((b) => b.priority === "High").slice(0, 2);
  const medium = blindSpots.filter((b) => b.priority === "Medium").slice(0, 2);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Blind Spots</CardTitle>
        <CardDescription>
          Important concepts you&apos;ve barely practiced
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {critical.length > 0 && <BlindSpotGroup title="Critical" items={critical} />}
          {high.length > 0 && <BlindSpotGroup title="High Priority" items={high} />}
          {medium.length > 0 && <BlindSpotGroup title="Medium" items={medium} />}
        </div>
      </CardContent>
    </Card>
  );
}

function BlindSpotGroup({
  title,
  items,
}: {
  title: string;
  items: BlindSpot[];
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-2">
        {items.map((b) => (
          <Link
            key={b.concept}
            href={`/concepts/${b.concept.toLowerCase().replace(/ /g, "-")}`}
            className="flex items-center justify-between rounded-md border border-border p-2.5 transition-colors hover:border-primary/50"
          >
            <div>
              <p className="text-sm font-medium">{b.concept}</p>
              <p className="text-xs text-muted-foreground">{b.reason}</p>
            </div>
            <PriorityBadge priority={b.priority} />
          </Link>
        ))}
      </div>
    </div>
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
            <CardTitle>Recommended Problems</CardTitle>
            <CardDescription>
              Personalized picks based on your skill gaps
            </CardDescription>
          </div>
          <Link
            href="/recommendations"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {recommendations.map((rec) => (
            <div
              key={`${rec.problem.platform}-${rec.problem.externalId}`}
              className="rounded-lg border border-border p-4 transition-colors hover:border-primary/50"
            >
              <div className="mb-2 flex items-center justify-between">
                <Badge variant={rec.type === "learn" ? "info" : rec.type === "challenge" ? "danger" : "success"}>
                  {rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}
                </Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  Score {rec.score}
                </span>
              </div>
              <p className="font-medium text-sm">{rec.problem.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <DifficultyBadge
                  platform={rec.problem.platform}
                  difficulty={rec.problem.difficulty}
                  rating={rec.problem.rating}
                />
                <Badge variant={rec.problem.platform === "codeforces" ? "info" : "success"}>
                  {rec.problem.platform === "codeforces" ? "Codeforces" : "LeetCode"}
                </Badge>
                <Badge variant="muted">{rec.concept}</Badge>
                <TopicTags tags={rec.problem.tags} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{rec.reason}</p>
              <a
                href={rec.problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
              >
                Solve on {rec.problem.platform === "codeforces" ? "Codeforces" : "LeetCode"} →
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TodayPlanSection({
  plan,
}: {
  plan: DailyPlan;
}) {
  if (!plan || plan.problems.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-primary" />
            <div>
              <CardTitle>What Should I Solve Today?</CardTitle>
              <CardDescription>
                A balanced mix for continuous improvement
              </CardDescription>
            </div>
          </div>
          <Link
            href="/roadmap"
            className="text-sm font-medium text-primary hover:underline"
          >
            Weekly roadmap →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {plan.problems.map((p, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {p.problem.title}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <DifficultyBadge
                        platform={p.problem.platform}
                        difficulty={p.problem.difficulty}
                        rating={p.problem.rating}
                      />
                      <Badge variant="muted">
                        {p.type.charAt(0).toUpperCase() + p.type.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="info">{p.concept}</Badge>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <TopicTags tags={p.problem.tags} max={3} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.reason}
                </p>
                <a
                  href={p.problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Open problem →
                </a>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}