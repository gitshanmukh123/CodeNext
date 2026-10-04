"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  Lightbulb,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ListChecks,
  Activity,
  BookOpen,
} from "lucide-react";
import { useProfile } from "@/lib/use-profile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface AIInsight {
  observation: string;
  category: "strength" | "weakness" | "pattern" | "recommendation";
}

const DEFAULT_INSIGHTS: AIInsight[] = [
  {
    observation:
      "Strong in Prefix Sum with 92% mastery. Use this foundation to explore related advanced concepts like Fenwick Tree and Segment Tree.",
    category: "strength",
  },
  {
    observation:
      "1D DP is a gap in your skills. Prioritize this area to become a more well-rounded programmer.",
    category: "weakness",
  },
  {
    observation:
      'Overall mastery: 58%. Focus on converting "Weak" concepts to "Developing" for the biggest improvement.',
    category: "pattern",
  },
  {
    observation:
      "Solve at least 2-3 problems daily from your weak areas for consistent improvement.",
    category: "recommendation",
  },
];

const DEFAULT_ADVICE = [
  "Focus on 1D DP this week - solve 5-10 problems starting from easy difficulty.",
  "Review problems you got wrong and understand the editorial solutions.",
  "Practice timed problem solving to improve speed under pressure.",
  "Alternate between learning new concepts and reinforcing existing ones.",
];

export default function InsightsPage() {
  const { profile } = useProfile();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [advice, setAdvice] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (profile.profileId === "demo") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInsights(DEFAULT_INSIGHTS);
      setAdvice(DEFAULT_ADVICE);
      setLoading(false);
      return;
    }

    const loadAI = async () => {
      try {
        const [insightsRes, adviceRes] = await Promise.all([
          fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profileId: profile.profileId, type: "insights" }),
          }),
          fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profileId: profile.profileId, type: "advice" }),
          }),
        ]);

        const insightsData = await insightsRes.json();
        const adviceData = await adviceRes.json();

        if (Array.isArray(insightsData.insights) && insightsData.insights.length > 0) {
          setInsights(insightsData.insights);
        } else {
          setInsights(DEFAULT_INSIGHTS);
        }

        if (Array.isArray(adviceData.advice) && adviceData.advice.length > 0) {
          setAdvice(adviceData.advice);
        } else {
          setAdvice(DEFAULT_ADVICE);
        }
      } catch {
        setError("Couldn't load AI insights right now.");
        setInsights(DEFAULT_INSIGHTS);
        setAdvice(DEFAULT_ADVICE);
      } finally {
        setLoading(false);
      }
    };

    loadAI();
  }, [profile]);

  const regenerate = useCallback(async () => {
    if (!profile || profile.profileId === "demo") return;
    setLoading(true);
    try {
      const [insightsRes, adviceRes] = await Promise.all([
        fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId: profile.profileId, type: "insights" }),
        }),
        fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId: profile.profileId, type: "advice" }),
        }),
      ]);

      const insightsData = await insightsRes.json();
      const adviceData = await adviceRes.json();

      if (Array.isArray(insightsData.insights) && insightsData.insights.length > 0) {
        setInsights(insightsData.insights);
      }
      if (Array.isArray(adviceData.advice) && adviceData.advice.length > 0) {
        setAdvice(adviceData.advice);
      }
      setError(null);
    } catch {
      setError("Couldn't regenerate insights right now.");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-xl font-bold">No profile selected</h2>
        <p className="max-w-md text-muted-foreground">
          Analyze a profile first to see AI-powered insights.
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

  const categoryInfo: Record<AIInsight["category"], { label: string; icon: typeof TrendingUp; className: string }> = {
    strength: {
      label: "Strength",
      icon: TrendingUp,
      className:
        "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-900/20",
    },
    weakness: {
      label: "Weakness",
      icon: AlertTriangle,
      className:
        "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20",
    },
    pattern: {
      label: "Pattern",
      icon: Activity,
      className:
        "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-900/20",
    },
    recommendation: {
      label: "Recommendation",
      icon: BookOpen,
      className:
        "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-900/20",
    },
  };

  const categoryOrder: AIInsight["category"][] = [
    "strength",
    "weakness",
    "pattern",
    "recommendation",
  ];

  const sortedInsights = [...insights].sort(
    (a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
  );

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
              <Brain className="text-primary" size={24} />
              AI Insights
            </h1>
            <p className="text-sm text-muted-foreground">
              Data-driven observations and study advice for your DSA journey
            </p>
          </div>
        </div>

        <button
          onClick={regenerate}
          disabled={loading || profile.profileId === "demo"}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles size={16} />
          {loading ? "Thinking..." : "Regenerate Insights"}
        </button>
      </div>

      {profile.profileId === "demo" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <strong>Demo Mode:</strong> Showing sample insights. Analyze a real
          profile to get AI-generated observations.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border bg-muted/50"
            />
          ))}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lightbulb className="text-amber-500" size={20} />
                <div>
                  <CardTitle>What the AI noticed</CardTitle>
                  <CardDescription>
                    Observations across your solving behavior, skill gaps, and progress
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sortedInsights.map((insight, i) => {
                  const info = categoryInfo[insight.category];
                  const Icon = info.icon;
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-3 rounded-lg border p-4 ${info.className}`}
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background">
                        <Icon size={16} className="text-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="muted">{info.label}</Badge>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground">
                          {insight.observation}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ListChecks className="text-primary" size={20} />
                <div>
                  <CardTitle>This Week&apos;s Study Advice</CardTitle>
                  <CardDescription>
                    Actionable steps to focus on in the coming days
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {advice.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {i + 1}
                    </div>
                    <p className="pt-0.5 text-sm text-foreground">{item}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-5">
                <p className="text-2xl font-bold">{insights.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  AI observations generated
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-2xl font-bold">{advice.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Study tips for this week
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-2xl font-bold">
                  {profile.codeforcesUsername && profile.leetcodeUsername
                    ? "2"
                    : "1"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Platforms analyzed
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}