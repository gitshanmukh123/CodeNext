import {
  BlindSpot,
  ConceptSkill,
  PlatformAnalysis,
  RecommendationItem,
  TrendingData,
} from "@/types";
import { CONCEPTS } from "@/data/concepts";

/**
 * Maps LeetCode difficulty to a Codeforces-equivalent rating.
 * This is what lets us combine both platforms into a single, fair score:
 * LC Easy ≈ CF 1000, LC Medium ≈ CF 1400, LC Hard ≈ CF 2000.
 */
export const LC_DIFFICULTY_RATING: Record<string, number> = {
  easy: 1000,
  medium: 1400,
  hard: 2000,
  unknown: 1200,
};

export function getEffectiveRating(problem: {
  rating?: number;
  difficulty?: string;
}): number {
  if (problem.rating && problem.rating > 0) return problem.rating;
  if (problem.difficulty) {
    return (
      LC_DIFFICULTY_RATING[problem.difficulty.toLowerCase()] || 1200
    );
  }
  return 0;
}

interface SubmissionData {
  platform: string;
  problemExternalId: string;
  verdict: string;
  submittedAt: string;
}

interface ProblemData {
  externalId: string;
  platform: string;
  concepts: string[];
  rating?: number;
  difficulty?: string;
}

export function analyzeConcepts(
  profileId: string,
  problems: ProblemData[],
  submissions: SubmissionData[]
): ConceptSkill[] {
  const conceptStats: Record<
    string,
    {
      solved: Set<string>;
      attempted: Set<string>;
      totalAttempts: number;
      difficultySum: number;
      difficultyCount: number;
      recentDate: string | null;
      cfSolved: number;
      lcSolved: number;
    }
  > = {};

  for (const concept of CONCEPTS) {
    conceptStats[concept.name] = {
      solved: new Set(),
      attempted: new Set(),
      totalAttempts: 0,
      difficultySum: 0,
      difficultyCount: 0,
      recentDate: null,
      cfSolved: 0,
      lcSolved: 0,
    };
  }

  const problemMap = new Map<string, ProblemData>();
  for (const p of problems) {
    problemMap.set(`${p.platform}:${p.externalId}`, p);
  }

  // Per-platform solution tracking so we can reward cross-platform breadth.
  const platformSolved: Record<string, { cf: Set<string>; lc: Set<string> }> =
    {};

  for (const sub of submissions) {
    const key = `${sub.platform}:${sub.problemExternalId}`;
    const problem = problemMap.get(key);

    if (!problem) continue;

    for (const concept of problem.concepts) {
      if (!conceptStats[concept]) continue;

      conceptStats[concept].attempted.add(sub.problemExternalId);
      conceptStats[concept].totalAttempts++;

      if (
        !conceptStats[concept].recentDate ||
        sub.submittedAt > conceptStats[concept].recentDate!
      ) {
        conceptStats[concept].recentDate = sub.submittedAt;
      }

      if (sub.verdict === "OK") {
        conceptStats[concept].solved.add(sub.problemExternalId);

        // Record the effective difficulty. LeetCode difficulties are converted
        // to a CF-equivalent rating so a LeetCode-heavy profile is never
        // unfairly penalized for having no CF rating data.
        const effectiveRating = getEffectiveRating(problem);
        if (effectiveRating > 0) {
          conceptStats[concept].difficultySum += effectiveRating;
          conceptStats[concept].difficultyCount++;
        }

        if (problem.platform === "codeforces") {
          conceptStats[concept].cfSolved++;
          if (!platformSolved[concept]) {
            platformSolved[concept] = { cf: new Set(), lc: new Set() };
          }
          platformSolved[concept].cf.add(sub.problemExternalId);
        } else {
          conceptStats[concept].lcSolved++;
          if (!platformSolved[concept]) {
            platformSolved[concept] = { cf: new Set(), lc: new Set() };
          }
          platformSolved[concept].lc.add(sub.problemExternalId);
        }
      }
    }
  }

  const conceptSkills: ConceptSkill[] = [];

  for (const concept of CONCEPTS) {
    const stats = conceptStats[concept.name];
    if (!stats) continue;

    const solvedCount = stats.solved.size;
    const attemptedCount = stats.attempted.size;
    const successRate =
      attemptedCount > 0 ? (solvedCount / attemptedCount) * 100 : 0;
    const averageDifficulty =
      stats.difficultyCount > 0
        ? stats.difficultySum / stats.difficultyCount
        : 0;
    const averageAttempts =
      attemptedCount > 0 ? stats.totalAttempts / attemptedCount : 0;

    const cfSolved = stats.cfSolved;
    const lcSolved = stats.lcSolved;

    const masteryScore = calculateMasteryScore({
      solvedCount,
      attemptedCount,
      averageDifficulty,
      recentActivity: stats.recentDate,
      successRate,
      codeforcesSolved: cfSolved,
      leetcodeSolved: lcSolved,
    });

    const status = getConceptStatus(masteryScore, solvedCount);

    conceptSkills.push({
      profileId,
      concept: concept.name,
      category: concept.category,
      solvedCount,
      attemptedCount,
      successRate: Math.round(successRate),
      averageDifficulty: Math.round(averageDifficulty),
      averageAttempts: Math.round(averageAttempts * 10) / 10,
      recentActivity: stats.recentDate,
      masteryScore: Math.round(masteryScore),
      status,
      codeforcesSolved: cfSolved,
      leetcodeSolved: lcSolved,
    });
  }

  return conceptSkills;
}

export interface MasteryInput {
  solvedCount: number;
  attemptedCount: number;
  averageDifficulty: number;
  recentActivity: string | null;
  successRate: number;
  codeforcesSolved?: number;
  leetcodeSolved?: number;
}

/**
 * A practical, explainable mastery model that combines BOTH platforms.
 *
 * The score is a weighted blend of six independent signals, each designed to
 * be robust to a single-platform profile:
 *   1. Volume   (0.30) - how many distinct problems solved (diminishing returns)
 *   2. Difficulty(0.20) - effective average CF-equivalent rating
 *   3. Success  (0.15) - % of attempted problems actually solved
 *   4. Consistency(0.10) - solutions per attempt (low re-attempt churn)
 *   5. Recency  (0.10) - how recently you practiced (decay curve)
 *   6. Cross-platform (0.15) - solved the concept on BOTH Codeforces & LeetCode
 *
 * The cross-platform term directly encodes "combined results from both
 * platforms" - proving a concept in two different judging ecosystems earns
 * extra credit, while a single-platform expert is never unfairly zeroed.
 */
export function calculateMasteryScore({
  solvedCount,
  attemptedCount,
  averageDifficulty,
  recentActivity,
  successRate,
  codeforcesSolved = 0,
  leetcodeSolved = 0,
}: MasteryInput): number {
  const solvedForVolume = Math.max(solvedCount, codeforcesSolved, leetcodeSolved);

  // Volume with diminishing returns: 1 solve ≈ 8, 10 ≈ 57, 30 ≈ 92, 50 ≈ 98.
  const volumeStrength = 100 * (1 - Math.exp(-solvedForVolume / 12));

  // Difficulty linearly mapped from CF-equivalent rating (800 → 2400 range).
  const difficultyStrength = clamp(
    ((averageDifficulty - 800) / (2400 - 800)) * 100,
    0,
    100
  );

  // Solutions per attempt - a high value means you solve cleanly, not by
  // brute-forcing round trips.
  const consistencyScore =
    attemptedCount > 0
      ? clamp(Math.min(1.3, (solvedCount / attemptedCount) * 1.3) * 100, 0, 100)
      : 0;

  const recencyScore = calculateRecencyScore(recentActivity);

  // Full credit only when the concept has been proven on both ecosystems.
  const crossPlatformScore =
    codeforcesSolved > 0 && leetcodeSolved > 0 ? 100 : 0;

  const mastery =
    0.3 * volumeStrength +
    0.2 * difficultyStrength +
    0.15 * Math.min(successRate, 100) +
    0.1 * consistencyScore +
    0.1 * recencyScore +
    0.15 * crossPlatformScore;

  return Math.min(Math.max(mastery, 0), 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function calculateRecencyScore(recentActivity: string | null): number {
  if (!recentActivity) return 0;

  const now = Date.now();
  const last = new Date(recentActivity).getTime();
  const daysDiff = (now - last) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 7) return 100;
  if (daysDiff <= 30) return 75;
  if (daysDiff <= 90) return 50;
  if (daysDiff <= 180) return 25;
  return 10;
}

export function getConceptStatus(
  masteryScore: number,
  solvedCount: number
): "Strong" | "Developing" | "Weak" | "Unexplored" {
  if (solvedCount === 0 && masteryScore === 0) return "Unexplored";
  if (masteryScore >= 65) return "Strong";
  if (masteryScore >= 35) return "Developing";
  return "Weak";
}

export function findWeakConcepts(
  skills: ConceptSkill[]
): ConceptSkill[] {
  return skills
    .filter((s) => s.status === "Weak" || s.status === "Unexplored")
    .sort((a, b) => a.masteryScore - b.masteryScore);
}

export function findStrongConcepts(skills: ConceptSkill[]): ConceptSkill[] {
  return skills
    .filter((s) => s.status === "Strong")
    .sort((a, b) => b.masteryScore - a.masteryScore);
}

export function findUnexploredConcepts(skills: ConceptSkill[]): ConceptSkill[] {
  return skills
    .filter((s) => s.status === "Unexplored")
    .sort((a, b) => {
      const impA =
        a.concept === "BFS" || a.concept === "DFS" || a.concept === "1D DP"
          ? 0
          : 1;
      const impB =
        b.concept === "BFS" || b.concept === "DFS" || b.concept === "1D DP"
          ? 0
          : 1;
      return impA - impB;
    });
}

export function getOverallMastery(skills: ConceptSkill[]): number {
  if (skills.length === 0) return 0;
  const sum = skills.reduce((acc, s) => acc + s.masteryScore, 0);
  return Math.round(sum / skills.length);
}

export function getCategoryMastery(skills: ConceptSkill[]): Record<string, number> {
  const categoryMap: Record<string, number[]> = {};

  for (const skill of skills) {
    if (!categoryMap[skill.category]) {
      categoryMap[skill.category] = [];
    }
    categoryMap[skill.category].push(skill.masteryScore);
  }

  const result: Record<string, number> = {};
  for (const [category, scores] of Object.entries(categoryMap)) {
    result[category] = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length
    );
  }

  return result;
}

/**
 * Builds a complete per-platform analysis (used by /codeforces & /leetcode).
 * Re-uses the global concept skills but filters mastery signals to the
 * selected platform, giving an honest "how am I doing on THIS platform".
 */
export function getPlatformAnalysis(
  profileId: string,
  platform: "codeforces" | "leetcode",
  conceptSkills: ConceptSkill[],
  recommendations: RecommendationItem[],
  blindSpots: BlindSpot[]
): PlatformAnalysis {
  const platformSkills: ConceptSkill[] = conceptSkills.map((skill) => {
    const solved =
      platform === "codeforces" ? skill.codeforcesSolved : skill.leetcodeSolved;

    // A false 0% is demotivating when the user simply hasn't used that
    // platform for a concept — keep flat scoring per concept but mark it
    // honestly as Unexplored.
    const masteryScore =
      solved > 0
        ? Math.round(
            (skill.masteryScore *
              (platform === "codeforces"
                ? skill.codeforcesSolved
                : skill.leetcodeSolved)) /
              Math.max(skill.solvedCount, 1)
          ) || skill.masteryScore
        : 0;

    const status: ConceptSkill["status"] =
      solved === 0
        ? "Unexplored"
        : masteryScore >= 65
          ? "Strong"
          : masteryScore >= 35
            ? "Developing"
            : "Weak";

    return {
      ...skill,
      masteryScore:
        solved > 0 ? Math.max(masteryScore, 5) : 0,
      status,
      solvedCount: solved,
    };
  });

  const platformRecommendations = recommendations.filter(
    (r) => r.problem.platform === platform
  );

  const platformBlindSpots = blindSpots
    .map((b) => ({ ...b }))
    .filter((b) => platformSkills.some((s) => s.concept === b.concept && s.status !== "Strong"))
    .sort((a, b) => {
      const order = { Critical: 0, High: 1, Medium: 2 };
      return order[a.priority] - order[b.priority];
    });

  const totalSolved = platformSkills.reduce((a, s) => a + s.solvedCount, 0);
  const overallMastery =
    platformSkills.length > 0
      ? Math.round(
          platformSkills.reduce((a, s) => a + s.masteryScore, 0) /
            platformSkills.length
        )
      : 0;

  const categoryMastery: Record<string, number> = {};
  const categoryMap: Record<string, number[]> = {};
  for (const skill of platformSkills) {
    if (!categoryMap[skill.category]) categoryMap[skill.category] = [];
    categoryMap[skill.category].push(skill.masteryScore);
  }
  for (const [category, scores] of Object.entries(categoryMap)) {
    categoryMastery[category] = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length
    );
  }

  const strong = platformSkills
    .filter((s) => s.status === "Strong")
    .sort((a, b) => b.masteryScore - a.masteryScore);
  const weak = platformSkills
    .filter((s) => s.status === "Weak" || s.status === "Unexplored")
    .sort((a, b) => a.masteryScore - b.masteryScore);
  const unexplored = platformSkills
    .filter((s) => s.status === "Unexplored")
    .sort((a, b) => {
      const imp: Record<string, number> = {
        "Binary Search": 0,
        "BFS": 1,
        "DFS": 1,
        "Two Pointers": 2,
        "Sliding Window": 2,
        "Prefix Sum": 2,
        "1D DP": 3,
        "Grid DP": 3,
      };
      return (imp[a.concept] ?? 99) - (imp[b.concept] ?? 99);
    });

  return {
    platform,
    conceptSkills: platformSkills,
    recommendations: platformRecommendations,
    blindSpots: platformBlindSpots,
    overallMastery,
    totalSolved,
    categoryMastery,
    strongConcepts: strong,
    weakConcepts: weak,
    unexploredConcepts: unexplored,
  };
}

/**
 * Produces a simple improving / stable / declining trend per concept for the
 * history page. The heuristic is intuitive:
 *  - practiced within the last 14 days   -> improving
 *  - practiced within the last 45 days   -> stable
 *  - practiced more than 45 days ago     -> declining
 */
export function analyzeTrending(conceptSkills: ConceptSkill[]): TrendingData[] {
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  return conceptSkills.map((skill) => {
    const daysAgo = skill.recentActivity
      ? (now - new Date(skill.recentActivity).getTime()) / DAY_MS
      : Number.POSITIVE_INFINITY;

    let direction: "improving" | "stable" | "declining" = "stable";
    if (skill.solvedCount === 0) {
      direction = "stable";
    } else if (daysAgo <= 14) {
      direction = "improving";
    } else if (daysAgo <= 45) {
      direction = "stable";
    } else {
      direction = "declining";
    }

    return {
      concept: skill.concept,
      direction,
      recentMastery: skill.masteryScore,
      olderMastery: Math.max(0, skill.masteryScore - (daysAgo <= 30 ? 8 : 0)),
      recentCount: skill.solvedCount,
    };
  });
}

export function analyzeFailurePatterns(
  submissions: SubmissionData[],
  problems: ProblemData[]
): Record<string, { avgAttempts: number; commonFailures: string[] }> {
  const problemMap = new Map<string, ProblemData>();
  for (const p of problems) {
    problemMap.set(`${p.platform}:${p.externalId}`, p);
  }

  const conceptFailures: Record<
    string,
    { attempts: number[]; failures: string[] }
  > = {};

  for (const sub of submissions) {
    const key = `${sub.platform}:${sub.problemExternalId}`;
    const problem = problemMap.get(key);
    if (!problem) continue;

    for (const concept of problem.concepts) {
      if (!conceptFailures[concept]) {
        conceptFailures[concept] = { attempts: [], failures: [] };
      }
    }
  }

  const conceptAttempts: Record<string, Record<string, number>> = {};

  for (const sub of submissions) {
    const key = `${sub.platform}:${sub.problemExternalId}`;
    const problem = problemMap.get(key);
    if (!problem) continue;

    for (const concept of problem.concepts) {
      if (!conceptAttempts[concept]) conceptAttempts[concept] = {};
      if (!conceptAttempts[concept][key]) conceptAttempts[concept][key] = 0;
      conceptAttempts[concept][key]++;
    }
  }

  for (const [concept, attempts] of Object.entries(conceptAttempts)) {
    const values = Object.values(attempts);
    conceptFailures[concept] = {
      attempts: values,
      failures: [],
    };

    const avgAttempts =
      values.reduce((a, b) => a + b, 0) / values.length;
    if (avgAttempts > 2.5) {
      conceptFailures[concept].failures.push(
        `Average attempts: ${avgAttempts.toFixed(1)}`
      );
    }
  }

  const result: Record<
    string,
    { avgAttempts: number; commonFailures: string[] }
  > = {};

  for (const [concept, data] of Object.entries(conceptFailures)) {
    const avgAttempts =
      data.attempts.length > 0
        ? data.attempts.reduce((a, b) => a + b, 0) / data.attempts.length
        : 0;
    result[concept] = {
      avgAttempts: Math.round(avgAttempts * 10) / 10,
      commonFailures: data.failures,
    };
  }

  return result;
}
