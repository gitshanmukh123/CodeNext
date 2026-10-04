import {
  BlindSpot,
  CodeforcesProfile,
  ConceptSkill,
  LeetCodeProfile,
  NormalizedProblem,
  RecommendationItem,
} from "@/types";
import {
  getCodeforcesProfile,
  getCodeforcesSubmissions,
  getCFProblemId,
  normalizeCFDifficulty,
  normalizeCFVerdict,
} from "@/lib/codeforces";
import {
  getLeetCodeProfile,
  getLeetCodeProblems,
  normalizeLCDifficulty,
} from "@/lib/leetcode";
import { mapTagsToConcepts } from "@/lib/concepts-mapper";
import {
  analyzeConcepts,
  getPlatformAnalysis,
  analyzeTrending,
} from "@/lib/analyzer";
import {
  generateRecommendations,
  findBlindSpots,
  getProblemKey,
} from "@/lib/recommender";
import { SEED_PROBLEMS } from "@/data/seedProblems";
import { PlatformAnalysis } from "@/types";
import Profile from "@/models/Profile";
import Problem from "@/models/Problem";
import Submission from "@/models/Submission";
import Analysis from "@/models/Analysis";
import Recommendation from "@/models/Recommendation";
import { AnalysisSubmission } from "@/lib/store";

export interface AnalysisSnapshot {
  codeforcesUsername?: string;
  leetcodeUsername?: string;
  codeforcesProfile: CodeforcesProfile | null;
  leetcodeProfile: LeetCodeProfile | null;
  problems: NormalizedProblem[];
  submissions: AnalysisSubmission[];
  conceptSkills: ConceptSkill[];
  recommendations: RecommendationItem[];
  blindSpots: BlindSpot[];
  codeforcesAnalysis: PlatformAnalysis | null;
  leetcodeAnalysis: PlatformAnalysis | null;
  trending: ReturnType<typeof analyzeTrending>;
  errors: string[];
}

export async function performAnalysis(
  profileId: string,
  codeforcesUsername?: string,
  leetcodeUsername?: string
): Promise<AnalysisSnapshot> {
  let cfProfile: CodeforcesProfile | null = null;
  let lcProfile: LeetCodeProfile | null = null;
  let cfSubmissions: Awaited<ReturnType<typeof getCodeforcesSubmissions>> = [];
  let lcProblems: Awaited<ReturnType<typeof getLeetCodeProblems>> = [];

  const errors: string[] = [];

  if (codeforcesUsername) {
    try {
      cfProfile = await getCodeforcesProfile(codeforcesUsername);
    } catch (e) {
      errors.push(
        `Codeforces: ${e instanceof Error ? e.message : "Failed to fetch"}`
      );
    }

    if (cfProfile) {
      try {
        cfSubmissions = await getCodeforcesSubmissions(codeforcesUsername);
      } catch (e) {
        errors.push(
          `Codeforces submissions: ${
            e instanceof Error ? e.message : "Failed to fetch"
          }`
        );
      }
    }
  }

  if (leetcodeUsername) {
    try {
      lcProfile = await getLeetCodeProfile(leetcodeUsername);
    } catch (e) {
      errors.push(
        `LeetCode: ${e instanceof Error ? e.message : "Failed to fetch"}`
      );
    }

    if (lcProfile) {
      try {
        lcProblems = await getLeetCodeProblems(leetcodeUsername);
      } catch (e) {
        errors.push(
          `LeetCode problems: ${
            e instanceof Error ? e.message : "Failed to fetch"
          }`
        );
      }
    }
  }

  const problems: NormalizedProblem[] = [];
  const submissions: AnalysisSubmission[] = [];

  if (cfSubmissions && Array.isArray(cfSubmissions)) {
    const problemMap = new Map<string, NormalizedProblem>();

    for (const sub of cfSubmissions) {
      const problemId = getCFProblemId(sub);

      if (!problemMap.has(problemId)) {
        const normalized = normalizeCFProblemToNormalized(sub, problemId);
        problemMap.set(problemId, normalized);
        problems.push(normalized);
      }

      submissions.push({
        profileId,
        platform: "codeforces",
        problemExternalId: problemId,
        verdict: normalizeCFVerdict(sub.verdict),
        submittedAt: new Date(sub.creationTimeSeconds * 1000).toISOString(),
      });
    }
  }

  for (const problem of lcProblems) {
    const normalized: NormalizedProblem = {
      platform: "leetcode",
      externalId: problem.titleSlug,
      title: problem.title,
      url: `https://leetcode.com/problems/${problem.titleSlug}/`,
      difficulty: normalizeLCDifficulty(problem.difficulty),
      tags: problem.topicTags.map((t) => t.slug),
      concepts: mapTagsToConcepts(
        problem.topicTags.map((t) => t.slug),
        "leetcode"
      ),
    };

    problems.push(normalized);

    submissions.push({
      profileId,
      platform: "leetcode",
      problemExternalId: problem.titleSlug,
      verdict: "OK",
      submittedAt: new Date().toISOString(),
    });
  }

  // Curated problem pool. Without it, the recommender can only draw from
  // problems the user has already SOLVED (which are then excluded), so a
  // connected platform with fresh users would be left with zero candidates.
  // Seeds give the engine breadth, limited to platforms actually in use.
  const problemsPlatformConnected = (pf: "codeforces" | "leetcode") =>
    (pf === "codeforces" && !!codeforcesUsername) ||
    (pf === "leetcode" && !!leetcodeUsername);

  const pool = new Set(problems.map((p) => getProblemKey(p)));
  for (const seed of SEED_PROBLEMS) {
    if (!problemsPlatformConnected(seed.platform)) continue;
    const key = getProblemKey(seed);
    if (!pool.has(key)) {
      pool.add(key);
      problems.push(seed);
    }
  }

  const conceptSkills = analyzeConcepts(profileId, problems, submissions);

  const solvedProblemIds = new Set(
    submissions
      .filter((s) => s.verdict === "OK")
      .map((s) => `${s.platform}:${s.problemExternalId}`)
  );

  const recommendations = generateRecommendations({
    problems,
    conceptSkills,
    solvedProblemIds,
  });

  const blindSpots = findBlindSpots(conceptSkills);

  const hasCF = (cfSubmissions && cfSubmissions.length > 0) || (cfProfile ?? false);
  const hasLC = (lcProblems && lcProblems.length > 0) || (lcProfile ?? false);

  const codeforcesAnalysis = hasCF
    ? getPlatformAnalysis(
        profileId,
        "codeforces",
        conceptSkills,
        recommendations,
        blindSpots
      )
    : null;

  const leetcodeAnalysis = hasLC
    ? getPlatformAnalysis(
        profileId,
        "leetcode",
        conceptSkills,
        recommendations,
        blindSpots
      )
    : null;

  const trending = analyzeTrending(conceptSkills);

  return {
    codeforcesUsername,
    leetcodeUsername,
    codeforcesProfile: cfProfile,
    leetcodeProfile: lcProfile,
    problems,
    submissions,
    conceptSkills,
    recommendations,
    blindSpots,
    codeforcesAnalysis,
    leetcodeAnalysis,
    trending,
    errors,
  };
}

export async function getOrCreateProfile(
  codeforcesUsername?: string,
  leetcodeUsername?: string
): Promise<string> {
  const cf = codeforcesUsername?.toLowerCase() || "";
  const lc = leetcodeUsername?.toLowerCase() || "";

  const profile = await Profile.findOneAndUpdate(
    { codeforcesUsername: cf, leetcodeUsername: lc },
    {
      $setOnInsert: {
        codeforcesUsername: cf,
        leetcodeUsername: lc,
      },
    },
    { upsert: true, new: true }
  );

  return profile._id.toString();
}

export async function persistAnalysisData(
  profileId: string,
  snapshot: AnalysisSnapshot
): Promise<void> {
  await Profile.findByIdAndUpdate(
    profileId,
    {
      codeforcesUsername: snapshot.codeforcesUsername?.toLowerCase() || "",
      leetcodeUsername: snapshot.leetcodeUsername?.toLowerCase() || "",
      codeforcesRating: snapshot.codeforcesProfile?.rating || 0,
      codeforcesMaxRating: snapshot.codeforcesProfile?.maxRating || 0,
      codeforcesRank: snapshot.codeforcesProfile?.rank || "",
      leetcodeTotalSolved: snapshot.leetcodeProfile?.totalSolved || 0,
      leetcodeEasySolved: snapshot.leetcodeProfile?.easySolved || 0,
      leetcodeMediumSolved: snapshot.leetcodeProfile?.mediumSolved || 0,
      leetcodeHardSolved: snapshot.leetcodeProfile?.hardSolved || 0,
    },
    { upsert: true, runValidators: true }
  );

  if (snapshot.problems.length > 0) {
    const bulkOps = snapshot.problems.map((p) => ({
      updateOne: {
        filter: { platform: p.platform, externalId: p.externalId },
        update: { $set: p },
        upsert: true,
      },
    }));
    await Problem.bulkWrite(bulkOps);
  }

  if (snapshot.submissions.length > 0) {
    await Submission.deleteMany({ profileId });
    const subOps = snapshot.submissions.map((s) => ({
      insertOne: {
        document: {
          profileId: s.profileId,
          platform: s.platform,
          problemExternalId: s.problemExternalId,
          verdict: s.verdict,
          submittedAt: new Date(s.submittedAt),
        },
      },
    }));
    await Submission.bulkWrite(subOps);
  }

  await Analysis.deleteMany({ profileId });
  const analysisOps = snapshot.conceptSkills.map((s) => ({
    insertOne: {
      document: { ...s, createdAt: new Date() },
    },
  }));
  await Analysis.bulkWrite(analysisOps);

  await Recommendation.deleteMany({ profileId });
  const recOps = snapshot.recommendations.map((r) => ({
    insertOne: {
      document: {
        profileId,
        problemExternalId: r.problem.externalId,
        platform: r.problem.platform,
        score: r.score,
        reason: r.reason,
        concept: r.concept,
        type: r.type,
        createdAt: new Date(),
      },
    },
  }));
  await Recommendation.bulkWrite(recOps);
}

function normalizeCFProblemToNormalized(
  sub: {
    problem: {
      contestId: number;
      index: string;
      name: string;
      rating?: number;
      tags: string[];
    };
  },
  problemId: string
): NormalizedProblem {
  const p = sub.problem;
  const concepts = mapTagsToConcepts(p.tags, "codeforces");

  return {
    platform: "codeforces",
    externalId: problemId,
    title: p.name,
    url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
    difficulty: normalizeCFDifficulty(p.rating),
    rating: p.rating,
    tags: p.tags,
    concepts,
  };
}