import {
  BlindSpot,
  CodeforcesProfile,
  ConceptSkill,
  LeetCodeProfile,
  NormalizedProblem,
  RecommendationItem,
} from "@/types";
import { DEMO_DATA } from "@/data/demo";

export interface AnalysisSubmission {
  profileId: string;
  platform: "codeforces" | "leetcode";
  problemExternalId: string;
  verdict: string;
  submittedAt: string;
}

export interface StoredAnalysis {
  profileId: string;
  codeforcesUsername?: string;
  leetcodeUsername?: string;
  codeforcesProfile: CodeforcesProfile | null;
  leetcodeProfile: LeetCodeProfile | null;
  conceptSkills: ConceptSkill[];
  recommendations: RecommendationItem[];
  blindSpots: BlindSpot[];
  problems: NormalizedProblem[];
  submissions: AnalysisSubmission[];
  errors?: string[];
}

export function isDatabaseConfigured(): boolean {
  return !!process.env.MONGODB_URI;
}

const memoryStore = new Map<string, StoredAnalysis>();

export function storeAnalysis(
  profileId: string,
  data: StoredAnalysis
): void {
  if (!isDatabaseConfigured()) {
    memoryStore.set(profileId, data);
  }
}

export function getStoredAnalysis(profileId: string): StoredAnalysis | null {
  if (isDatabaseConfigured()) return null;
  seedDemoIfNeeded();
  return memoryStore.get(profileId) || null;
}

export function clearStoredAnalysis(profileId: string): void {
  if (!isDatabaseConfigured()) {
    memoryStore.delete(profileId);
  }
}

export function deriveLocalProfileId(
  codeforcesUsername?: string,
  leetcodeUsername?: string
): string {
  const cf = (codeforcesUsername || "none").toLowerCase().trim();
  const lc = (leetcodeUsername || "none").toLowerCase().trim();
  return `local-${cf}-${lc}`;
}

export function findStoredByUsernames(
  codeforcesUsername?: string | undefined,
  leetcodeUsername?: string | undefined
): StoredAnalysis | null {
  if (isDatabaseConfigured()) return null;
  seedDemoIfNeeded();
  const cf = codeforcesUsername?.toLowerCase().trim() || "";
  const lc = leetcodeUsername?.toLowerCase().trim() || "";
  for (const entry of memoryStore.values()) {
    const entryCf = (entry.codeforcesUsername || "").toLowerCase().trim();
    const entryLc = (entry.leetcodeUsername || "").toLowerCase().trim();
    if ((cf && entryCf === cf) || (lc && entryLc === lc)) {
      return entry;
    }
  }
  return null;
}

function seedDemoIfNeeded(): void {
  if (memoryStore.has("demo")) return;
  memoryStore.set("demo", {
    profileId: "demo",
    codeforcesUsername: "tourist",
    leetcodeUsername: "demo_user",
    codeforcesProfile: DEMO_DATA.codeforcesProfile,
    leetcodeProfile: DEMO_DATA.leetcodeProfile,
    conceptSkills: DEMO_DATA.conceptSkills,
    recommendations: DEMO_DATA.recommendations,
    blindSpots: DEMO_DATA.blindSpots,
    problems: DEMO_DATA.problems,
    submissions: DEMO_DATA.submissions,
  });
}