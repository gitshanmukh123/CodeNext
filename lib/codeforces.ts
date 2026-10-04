import { CodeforcesProfile, CodeforcesContest } from "@/types";

const CF_API_BASE = "https://codeforces.com/api";

interface CFUserResponse {
  status: string;
  result: Array<{
    handle: string;
    rating?: number;
    maxRating?: number;
    rank?: string;
    maxRank?: string;
    avatar?: string;
    titlePhoto?: string;
    contribution?: number;
    lastOnlineTimeSeconds?: number;
    registrationTimeSeconds?: number;
  }>;
}

interface CFContestResponse {
  status: string;
  result: Array<{
    contestId: number;
    contestName: string;
    rank: number;
    oldRating: number;
    newRating: number;
    ratingChange: number;
    timeSeconds: number;
  }>;
}

export interface CFSubmission {
  id: number;
  contestId: number;
  problem: {
    contestId: number;
    index: string;
    name: string;
    rating?: number;
    tags: string[];
    type: string;
  };
  verdict: string;
  programmingLanguage: string;
  creationTimeSeconds: number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
}

interface CFStatusResponse {
  status: string;
  result: CFSubmission[];
}

export async function getCodeforcesProfile(
  username: string
): Promise<CodeforcesProfile> {
  const res = await fetch(
    `${CF_API_BASE}/user.info?handles=${encodeURIComponent(username)}`,
    { next: { revalidate: 300 } }
  );

  if (!res.ok) throw new Error(`Codeforces API error: ${res.status}`);

  const data: CFUserResponse = await res.json();

  if (data.status !== "OK" || !data.result || data.result.length === 0) {
    throw new Error(`User "${username}" not found on Codeforces`);
  }

  const user = data.result[0];

  return {
    username: user.handle,
    rating: user.rating || 0,
    maxRating: user.maxRating || 0,
    rank: user.rank || "unranked",
    maxRank: user.maxRank || "unranked",
    avatar: user.avatar || "",
    titlePhoto: user.titlePhoto || "",
    contribution: user.contribution || 0,
    lastOnlineTimeSeconds: user.lastOnlineTimeSeconds || 0,
    registrationTimeSeconds: user.registrationTimeSeconds || 0,
  };
}

export async function getCodeforcesContests(
  username: string
): Promise<CodeforcesContest[]> {
  const res = await fetch(
    `${CF_API_BASE}/user.rating?handle=${encodeURIComponent(username)}`,
    { next: { revalidate: 300 } }
  );

  if (!res.ok) throw new Error(`Codeforces API error: ${res.status}`);

  const data: CFContestResponse = await res.json();

  if (data.status !== "OK") {
    throw new Error("Failed to fetch contest history");
  }

  return data.result.map((c) => ({
    contestId: c.contestId,
    contestName: c.contestName,
    rank: c.rank,
    oldRating: c.oldRating,
    newRating: c.newRating,
    ratingChange: c.ratingChange,
    timeSeconds: c.timeSeconds,
  }));
}

export async function getCodeforcesSubmissions(
  username: string
): Promise<CFSubmission[]> {
  const res = await fetch(
    `${CF_API_BASE}/user.status?handle=${encodeURIComponent(username)}`,
    { next: { revalidate: 300 } }
  );

  if (!res.ok) throw new Error(`Codeforces API error: ${res.status}`);

  const data: CFStatusResponse = await res.json();

  if (data.status !== "OK") {
    throw new Error("Failed to fetch submissions");
  }

  return data.result;
}

export function getCFProblemId(submission: CFSubmission): string {
  return `${submission.problem.contestId}-${submission.problem.index}`;
}

export function normalizeCFDifficulty(rating?: number): string {
  if (!rating) return "unknown";
  if (rating < 1200) return "easy";
  if (rating < 1600) return "medium";
  if (rating < 2000) return "hard";
  return "very hard";
}

export function normalizeCFVerdict(verdict: string): string {
  switch (verdict) {
    case "OK":
      return "OK";
    case "WRONG_ANSWER":
      return "WRONG_ANSWER";
    case "TIME_LIMIT_EXCEEDED":
      return "TIME_LIMIT_EXCEEDED";
    case "RUNTIME_ERROR":
      return "RUNTIME_ERROR";
    case "COMPILATION_ERROR":
      return "COMPILATION_ERROR";
    case "MEMORY_LIMIT_EXCEEDED":
      return "MEMORY_LIMIT_EXCEEDED";
    default:
      return verdict;
  }
}
