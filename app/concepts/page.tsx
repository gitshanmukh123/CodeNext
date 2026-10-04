"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitBranch, ArrowLeft } from "lucide-react";
import { useProfile } from "@/lib/use-profile";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface ConceptInfo {
  concept: string;
  category: string;
  description: string;
  importance: string;
  masteryScore: number;
  status: string;
  solvedCount: number;
}

export default function ConceptsPage() {
  const { profile } = useProfile();
  const [concepts, setConcepts] = useState<ConceptInfo[]>([]);
  const [overall, setOverall] = useState(0);
  const [categoryMastery, setCategoryMastery] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const fetchSkills = async () => {
      try {
        const res = await fetch(`/api/skills?profileId=${profile.profileId}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load concepts");
          return;
        }
        const data = await res.json();
        setConcepts(data.concepts);
        setOverall(data.overallMastery);
        setCategoryMastery(data.categoryMastery);
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchSkills();
  }, [profile]);

  if (!profile) {
    return (
      <EmptyState
        title="No profile selected"
        message="Analyze a profile first to see concept-level insights."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <p className="text-muted-foreground">Loading concepts...</p>
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Error" message={error} />;
  }

  const statusOrder: Record<string, number> = {
    Strong: 0,
    Developing: 1,
    Weak: 2,
    Unexplored: 3,
  };

  const sorted = [...concepts].sort(
    (a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
  );

  const categories = [...new Set(sorted.map((c) => c.category))];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <GitBranch className="text-primary" size={24} />
            Concept Mastery
          </h1>
          <p className="text-sm text-muted-foreground">
            Overall mastery: {overall}% across 50+ DSA concepts
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(categoryMastery)
          .sort((a, b) => b[1] - a[1])
          .map(([category, mastery]) => (
            <Card key={category}>
              <CardContent className="pt-5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">{category}</span>
                  <span className="text-sm font-bold">{mastery}%</span>
                </div>
                <ProgressBar value={mastery} />
              </CardContent>
            </Card>
          ))}
      </div>

      {categories.map((category) => (
        <div key={category}>
          <h2 className="mb-3 text-lg font-semibold">{category}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted
              .filter((c) => c.category === category)
              .map((c) => (
                <Link
                  key={c.concept}
                  href={`/concepts/${c.concept.toLowerCase().replace(/ /g, "-")}`}
                  className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{c.concept}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{c.solvedCount} solved</span>
                    <span className="font-medium">{c.masteryScore}%</span>
                  </div>
                  <ProgressBar value={c.masteryScore} />
                </Link>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="max-w-md text-muted-foreground">{message}</p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Analyze a Profile
      </Link>
    </div>
  );
}