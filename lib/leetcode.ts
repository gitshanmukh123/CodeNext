import { LeetCodeProfile } from "@/types";

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Referer: "https://leetcode.com",
  Origin: "https://leetcode.com",
};

export async function getLeetCodeProfile(
  username: string
): Promise<LeetCodeProfile> {
  try {
    const query = `
      query userPublicProfile($username: String!) {
        matchedUser(username: $username) {
          username
          submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
            }
          }
          profile {
            ranking
            reputation
          }
        }
      }
    `;

    const res = await fetch(LEETCODE_GRAPHQL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ query, variables: { username } }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`LeetCode API error: ${res.status}`);
    }

    const data = await res.json();

    if (!data.data?.matchedUser) {
      throw new Error(`User "${username}" not found on LeetCode`);
    }

    const user = data.data.matchedUser;
    const stats = user.submitStatsGlobal?.acSubmissionNum || [];

    const getCount = (difficulty: string): number => {
      const entry = stats.find(
        (s: { difficulty: string; count: number }) => s.difficulty === difficulty
      );
      return entry?.count || 0;
    };

    const totalSolved = getCount("All");
    const easySolved = getCount("Easy");
    const mediumSolved = getCount("Medium");
    const hardSolved = getCount("Hard");

    return {
      username: user.username,
      totalSolved,
      easySolved,
      mediumSolved,
      hardSolved,
      acceptanceRate: 0,
      ranking: user.profile?.ranking || 0,
      contributionPoints: user.profile?.reputation || 0,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch LeetCode profile: ${error.message}`);
    }
    throw new Error("Failed to fetch LeetCode profile");
  }
}

export interface LeetCodeProblem {
  title: string;
  titleSlug: string;
  difficulty: string;
  topicTags: { name: string; slug: string }[];
}

export async function getLeetCodeProblems(
  username: string
): Promise<LeetCodeProblem[]> {
  try {
    const query = `
      query userProblemsSolved($username: String!) {
        recentAcSubmissionList(username: $username, limit: 50) {
          id
          title
          titleSlug
          timestamp
        }
      }
    `;

    const res = await fetch(LEETCODE_GRAPHQL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ query, variables: { username } }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const submissions = data.data?.recentAcSubmissionList || [];

    const problems: LeetCodeProblem[] = [];
    const seen = new Set<string>();

    for (const sub of submissions) {
      if (seen.has(sub.titleSlug)) continue;
      seen.add(sub.titleSlug);

      const details = await getLeetCodeProblemDetails(sub.titleSlug);
      if (details) {
        problems.push(details);
      }
    }

    return problems;
  } catch {
    return [];
  }
}

async function getLeetCodeProblemDetails(
  titleSlug: string
): Promise<LeetCodeProblem | null> {
  try {
    const query = `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          title
          titleSlug
          difficulty
          topicTags {
            name
            slug
          }
        }
      }
    `;

    const res = await fetch(LEETCODE_GRAPHQL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ query, variables: { titleSlug } }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const q = data.data?.question;
    if (!q) return null;

    return {
      title: q.title,
      titleSlug: q.titleSlug,
      difficulty: q.difficulty,
      topicTags: q.topicTags || [],
    };
  } catch {
    return null;
  }
}

export function normalizeLCDifficulty(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "easy";
    case "medium":
      return "medium";
    case "hard":
      return "hard";
    default:
      return "unknown";
  }
}
