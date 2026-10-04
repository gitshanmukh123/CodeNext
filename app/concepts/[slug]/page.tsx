"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Link2, Lightbulb } from "lucide-react";
import { useProfile } from "@/lib/use-profile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";

interface ConceptDetailData {
  concept: string;
  category: string;
  description: string;
  importance: string;
  masteryScore: number;
  status: string;
  solvedCount: number;
  attemptedCount: number;
  successRate: number;
  averageDifficulty: number;
  recentActivity: string | null;
  codeforcesSolved: number;
  leetcodeSolved: number;
  prerequisites: string[];
  dependents: string[];
  strong: string[];
  weak: string[];
  unexplored: string[];
  solvedProblems: { title: string; platform: string; difficulty: string; rating: number; url: string }[];
}

export default function ConceptDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { profile } = useProfile();
  const [detail, setDetail] = useState<ConceptDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const fetchDetail = async () => {
      try {
        const res = await fetch(
          `/api/skills/${slug}?profileId=${profile.profileId}`
        );
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load concept");
          return;
        }
        const data = await res.json();
        setDetail(data);
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [slug, profile]);

  const loadAIExplanation = useCallback(async () => {
    if (!detail) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profile?.profileId,
          type: "concept",
          concept: detail.concept,
        }),
      });
      const data = await res.json();
      setAiExplanation(data.explanation || "Couldn't generate an explanation right now.");
    } finally {
      setAiLoading(false);
    }
  }, [detail, profile]);

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-xl font-bold">No profile selected</h2>
        <p className="max-w-md text-muted-foreground">
          Analyze a profile first to see concept-level insights.
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

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <p className="text-muted-foreground">Loading concept...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-xl font-bold">Error</h2>
        <p className="text-muted-foreground">{error || "Concept not found"}</p>
        <Link
          href="/concepts"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to Concepts
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <Link
          href="/concepts"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{detail.concept}</h1>
            <StatusBadge status={detail.status} />
            <Badge variant="muted">{detail.category}</Badge>
            <Badge variant="info">{detail.importance} level</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{detail.description}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Your Progress</CardTitle>
              <CardDescription>Overall concept mastery across platforms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-4xl font-bold">{detail.masteryScore}%</span>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Codeforces: {detail.codeforcesSolved}</span>
                  <span>LeetCode: {detail.leetcodeSolved}</span>
                </div>
              </div>
              <ProgressBar value={detail.masteryScore} className="mb-4" />

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatBlock label="Solved" value={detail.solvedCount} />
                <StatBlock
                  label="Attempted"
                  value={detail.attemptedCount}
                />
                <StatBlock label="Success Rate" value={`${detail.successRate}%`} />
                <StatBlock
                  label="Avg Difficulty"
                  value={
                    detail.averageDifficulty > 0
                      ? detail.averageDifficulty.toString()
                      : "—"
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Why This Matters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {getWhyMatters(detail.concept, detail.importance)}
                </p>
              </div>
            </CardContent>
          </Card>

          {detail.solvedProblems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Solved Problems in This Concept</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {detail.solvedProblems.map((p, i) => (
                    <a
                      key={i}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:border-primary/50"
                    >
                      <div className="flex items-center gap-2">
                        <Link2 size={14} className="shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium">{p.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="muted">{p.platform}</Badge>
                        <DifficultyBadge
                          platform={p.platform}
                          difficulty={p.difficulty}
                          rating={p.rating}
                        />
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Explore with AI</CardTitle>
              <CardDescription>
                Get a personalized explanation of this concept and why it matters for you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiExplanation ? (
                <div className="rounded-lg bg-muted p-4 text-sm leading-relaxed">
                  {aiExplanation}
                </div>
              ) : (
                <button
                  onClick={loadAIExplanation}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <BookOpen size={16} />
                  {aiLoading ? "Thinking..." : "Generate AI Explanation"}
                </button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Prerequisites</CardTitle>
              <CardDescription>Learn these first</CardDescription>
            </CardHeader>
            <CardContent>
              {detail.prerequisites.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This is a foundational concept — no strict prerequisites.
                </p>
              ) : (
                <div className="space-y-2">
                  {detail.prerequisites.map((p) => (
                    <Link
                      key={p}
                      href={`/concepts/${p.toLowerCase().replace(/ /g, "-")}`}
                      className="block rounded-md border border-border p-2.5 text-sm transition-colors hover:border-primary/50"
                    >
                      {p}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Builds Toward</CardTitle>
              <CardDescription>Related advanced concepts</CardDescription>
            </CardHeader>
            <CardContent>
              {detail.dependents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This concept doesn&apos;t directly feed into others in the taxonomy.
                </p>
              ) : (
                <div className="space-y-2">
                  {detail.dependents.map((p) => (
                    <Link
                      key={p}
                      href={`/concepts/${p.toLowerCase().replace(/ /g, "-")}`}
                      className="block rounded-md border border-border p-2.5 text-sm transition-colors hover:border-primary/50"
                    >
                      {p}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {detail.unexplored.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Unexplored Related</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {detail.unexplored.map((p) => (
                    <Link
                      key={p}
                      href={`/concepts/${p.toLowerCase().replace(/ /g, "-")}`}
                    >
                      <Badge variant="muted">{p}</Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Platforms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Codeforces</span>
                  <span className="font-medium">{detail.codeforcesSolved} solved</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>LeetCode</span>
                  <span className="font-medium">{detail.leetcodeSolved} solved</span>
                </div>
                {detail.codeforcesSolved > 0 && detail.leetcodeSolved > 0 && (
                  <p className="mt-1 rounded-md bg-emerald-50 p-2 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                    Verified on both platforms — your mastery is more robust than
                    a single-platform expert&apos;s.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function getWhyMatters(concept: string, importance: string): string {
  const reasons: Record<string, string> = {
    "Prefix Sum":
      "Prefix sums are the foundation of efficient range queries. Many array-based problems become trivial once you precompute cumulative sums — it's a core technique in coding interviews and competitive programming.",
    "Sliding Window":
      "The sliding window pattern turns O(n²) brute-force subarray problems into O(n) solutions. It shows up constantly in interviews and is a building block for more complex optimization techniques.",
    "Binary Search":
      "Binary search is the single most frequently tested algorithm in interviews after arrays and strings. Mastering the canonical pattern and its variations unlocks a huge portion of hard problems.",
    "BFS":
      "BFS is the standard approach for shortest paths in unweighted graphs and level-order traversal. It's a prerequisite for almost every other graph algorithm, including Dijkstra, 0-1 BFS, and bipartiteness checking.",
    "DFS":
      "DFS forms the backbone of graph exploration — cycle detection, topological sort, connected components, and SCC all build on it. It's one of the first advanced skills interviewers probe.",
    "Dijkstra":
      "Dijkstra is the canonical weighted shortest-path algorithm. Every competitive programmer interviews with graph problems will be expected to know it cold, including heap-based optimization.",
    "1D DP":
      "1D DP is where most people first learn dynamic programming. The transition from recursion with memoization to iterative DP is one of the biggest conceptual leaps in the curriculum.",
    "Knapsack":
      "Knapsack is the quintessential DP with states — the pattern generalizes to countless problems where you decide between taking or skipping an item with two parameters.",
    "2D DP":
      "2D DP handles grid-based and pairwise problems. It's the natural next step after 1D DP and unlocks matrix, LCS, and edit-distance style questions that appear in interviews constantly.",
    "Segment Tree":
      "Segment trees handle dynamic range queries in O(log n) — building them cleanly signals deep understanding of tree decomposition and is the gateway to advanced data structures like lazy propagation.",
    "SCC":
      "Strongly Connected Components compress a directed graph into a DAG, turning impossible-sounding problems into topological ones. It's the most common topic for genuinely hard Codeforces rounds.",
    "LCA":
      "Lowest Common Ancestor is the key primitive for tree path queries. Combined with binary lifting it becomes an essential trick — and it often appears in Div 2 D and above problems.",
    "Priority Queue":
      "Priority queues power Dijkstra, MST, scheduling, and many greedy problems. The heap is one of the most-reused data structures in competitive programming.",
    "Topological Sort":
      "Topological sort gives an ordering for dependency problems — it's the standard technique for anything that looks like 'do task A before task B'. Frequently combined with DP on DAGs.",
    "DSU":
      "Union-Find is a tiny amount of code that solves connectivity, cycle detection in Kruskal's MST, and many offline query problems. It's a viva favorite because it's elegant and fast.",
    "Two Pointers":
      "Two pointers is a simple pattern that solves an enormous class of linear-array problems in O(n). It's among the first 'aha' patterns that distinguishes structured problem solvers.",
    "Monotonic Stack":
      "The monotonic stack is the pattern for 'next greater/smaller element' style problems. Nailing its justification makes you stand out in interviews.",
    "Binary Search on Answer":
      "Binary searching on the answer converts optimization problems into feasibility checks. It's a hallmark of strong competitive programmers and appears across difficulty levels.",
    "Basic Trie":
      "Tries give linear-time prefix queries and are the foundation for autocomplete, bitwise maximum XOR, and many string problems. They appear in interviews more than most expect.",
    "Fenwick Tree":
      "A Fenwick tree performs range sums and point updates in O(log n) with a tiny implementation. It's a lightweight alternative to segment trees that is very common in Codeforces.",
    "MST":
      "Minimum spanning trees (Kruskal/Prim) formalize network-building problems. MST techniques overlap heavily with DSU, sorting, and greedy reasoning.",
    "0-1 BFS":
      "0-1 BFS solves shortest paths when edge weights are 0 or 1 in linear time — a beautiful use of a deque. It generalizes BFS and is commonly tested at 1600+ rating.",
    "Greedy":
      "Greedy reasoning is about proving the optimal choice at each step. Most 'easy-to-state, easy-to-get-wrong' Codeforces problems test exactly this.",
    "Tree DP":
      "Tree DP combines dynamic programming with DFS — computing subtree states and re-rooting is a core competitive programming skill that shows up in Div 2 E/F problems.",
    "Bitmask DP":
      "Bitmask DP (e.g., TSP) is the canonical state-over-subsets technique. It's the most recognizable 'advanced DP' topic for interviews and contests alike.",
    "Interval DP":
      "Interval DP (e.g., matrix chain multiplication) is the classic 'choose the split point' pattern. It is a standard advanced DP topic with elegant, teachable-able recurrences.",
  };

  return (
    reasons[concept] ||
    `This ${importance}-level concept builds a foundation for higher-rated problems. Understanding it well makes you a more adaptable problem solver.`
  );
}