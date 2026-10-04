export type Platform = "codeforces" | "leetcode";

export type Difficulty = "easy" | "medium" | "hard";

export type ConceptStatus = "Strong" | "Developing" | "Weak" | "Unexplored";

export type Verdict =
  | "OK"
  | "WRONG_ANSWER"
  | "TIME_LIMIT_EXCEEDED"
  | "RUNTIME_ERROR"
  | "COMPILATION_ERROR"
  | "MEMORY_LIMIT_EXCEEDED"
  | "CHALLENGED"
  | "SKIPPED";

export interface NormalizedProblem {
  platform: Platform;
  externalId: string;
  title: string;
  url: string;
  difficulty?: string;
  rating?: number;
  tags: string[];
  concepts: string[];
}

export interface NormalizedSubmission {
  profileId: string;
  platform: Platform;
  problemExternalId: string;
  verdict: string;
  submittedAt: string;
  language?: string;
  contestId?: number;
  timeSeconds?: number;
  memoryBytes?: number;
}

export interface ConceptSkill {
  profileId: string;
  concept: string;
  category: string;
  solvedCount: number;
  attemptedCount: number;
  successRate: number;
  averageDifficulty: number;
  averageAttempts: number;
  recentActivity: string | null;
  masteryScore: number;
  status: ConceptStatus;
  codeforcesSolved: number;
  leetcodeSolved: number;
}

export interface RecommendationItem {
  problem: NormalizedProblem;
  score: number;
  reason: string;
  concept: string;
  type: "learn" | "practice" | "reinforce" | "challenge";
}

export interface DailyPlan {
  date: string;
  problems: {
    problem: NormalizedProblem;
    concept: string;
    type: "learn" | "practice" | "reinforce" | "challenge";
    reason: string;
  }[];
}

export interface WeeklyPlan {
  startDate: string;
  days: {
    day: string;
    theme: string;
    problems: {
      problem: NormalizedProblem;
      concept: string;
      type: "learn" | "practice" | "reinforce" | "challenge";
      reason: string;
    }[];
  }[];
}

export interface CodeforcesProfile {
  username: string;
  rating: number;
  maxRating: number;
  rank: string;
  maxRank: string;
  avatar: string;
  titlePhoto: string;
  contribution: number;
  lastOnlineTimeSeconds: number;
  registrationTimeSeconds: number;
}

export interface CodeforcesContest {
  contestId: number;
  contestName: string;
  rank: number;
  oldRating: number;
  newRating: number;
  ratingChange: number;
  timeSeconds: number;
}

export interface CodeforcesProblem {
  contestId?: number;
  problemsetProblemIndex?: string;
  index: string;
  name: string;
  rating?: number;
  tags: string[];
  type: string;
}

export interface LeetCodeProfile {
  username: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  acceptanceRate: number;
  ranking: number;
  contributionPoints: number;
}

export interface BlindSpot {
  concept: string;
  category: string;
  priority: "Critical" | "High" | "Medium";
  reason: string;
  masteryScore: number;
}

export interface ConceptDetail {
  concept: string;
  category: string;
  masteryScore: number;
  status: ConceptStatus;
  solvedCount: number;
  attemptedCount: number;
  successRate: number;
  averageDifficulty: string;
  strong: string[];
  weak: string[];
  unexplored: string[];
  prerequisites: string[];
  whyMatters: string;
  recommendedProblems: RecommendationItem[];
}

export interface AnalysisSnapshot {
  profileId: string;
  timestamp: string;
  overallMastery: number;
  conceptScores: { concept: string; mastery: number; status: ConceptStatus }[];
}

export interface PlatformAnalysis {
  platform: Platform;
  conceptSkills: ConceptSkill[];
  recommendations: RecommendationItem[];
  blindSpots: BlindSpot[];
  overallMastery: number;
  totalSolved: number;
  categoryMastery: Record<string, number>;
  strongConcepts: ConceptSkill[];
  weakConcepts: ConceptSkill[];
  unexploredConcepts: ConceptSkill[];
}

export interface ConceptProgression {
  concept: string;
  category: string;
  masteryScore: number;
  status: ConceptStatus;
  prerequisites: string[];
  dependents: string[];
  prerequisitesMet: boolean;
  cfSolved: number;
  lcSolved: number;
  solvedCount: number;
  recentActivity: string | null;
}

export interface TrendingData {
  concept: string;
  direction: "improving" | "stable" | "declining";
  recentMastery: number;
  olderMastery: number;
  recentCount: number;
}

export interface DemoData {
  codeforcesProfile: CodeforcesProfile;
  leetcodeProfile: LeetCodeProfile;
  problems: NormalizedProblem[];
  submissions: NormalizedSubmission[];
  conceptSkills: ConceptSkill[];
  recommendations: RecommendationItem[];
  blindSpots: BlindSpot[];
}
