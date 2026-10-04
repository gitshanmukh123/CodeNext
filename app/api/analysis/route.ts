import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { isDatabaseConfigured, getStoredAnalysis } from "@/lib/store";
import { getPlatformAnalysis } from "@/lib/analyzer";
import { buildConceptProgression } from "@/lib/recommender";
import Analysis from "@/models/Analysis";
import Recommendation from "@/models/Recommendation";
import Problem from "@/models/Problem";
import Profile from "@/models/Profile";
import { BlindSpot, ConceptSkill, RecommendationItem } from "@/types";

/**
 * Returns the full stored analysis snapshot for a profile. This is the single
 * source of truth used by /codeforces, /leetcode and /insights pages so they
 * never have to hit multiple endpoints.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    let conceptSkills: ConceptSkill[] = [];
    let recommendations: RecommendationItem[] = [];
    let blindSpots: BlindSpot[] = [];
    let codeforcesProfile: Record<string, unknown> | null = null;
    let leetcodeProfile: Record<string, unknown> | null = null;

    if (!isDatabaseConfigured()) {
      const stored = getStoredAnalysis(profileId);
      if (!stored) {
        return NextResponse.json(
          { error: "Profile not found. Run an analysis first." },
          { status: 404 }
        );
      }
      conceptSkills = stored.conceptSkills;
      recommendations = stored.recommendations;
      blindSpots = stored.blindSpots;
      codeforcesProfile = stored.codeforcesProfile as Record<string, unknown> | null;
      leetcodeProfile = stored.leetcodeProfile as Record<string, unknown> | null;
    } else {
      await connectToDatabase();

      const profile = await Profile.findById(profileId);
      if (!profile) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 }
        );
      }
      codeforcesProfile = {
        username: profile.codeforcesUsername,
        rating: profile.codeforcesRating,
        maxRating: profile.codeforcesMaxRating,
        rank: profile.codeforcesRank,
      };
      leetcodeProfile = {
        username: profile.leetcodeUsername,
        totalSolved: profile.leetcodeTotalSolved,
        easySolved: profile.leetcodeEasySolved,
        mediumSolved: profile.leetcodeMediumSolved,
        hardSolved: profile.leetcodeHardSolved,
      };

      const analyses = await Analysis.find({ profileId });
      conceptSkills = analyses.map((a) => ({
        profileId: a.profileId,
        concept: a.concept,
        category: a.category,
        solvedCount: a.solvedCount,
        attemptedCount: a.attemptedCount,
        successRate: a.successRate,
        averageDifficulty: a.averageDifficulty,
        averageAttempts: a.averageAttempts,
        recentActivity: a.recentActivity,
        masteryScore: a.masteryScore,
        status: a.status as "Strong" | "Developing" | "Weak" | "Unexplored",
        codeforcesSolved: a.codeforcesSolved,
        leetcodeSolved: a.leetcodeSolved,
      }));
      blindSpots = conceptSkills
        .filter((s) => s.status === "Weak" || s.status === "Unexplored")
        .map((s) => ({
          concept: s.concept,
          category: s.category,
          priority: s.status === "Unexplored" ? "High" : "Medium",
          reason: `${s.concept} needs attention (${s.masteryScore}% mastery).`,
          masteryScore: s.masteryScore,
        }));

      const recs = await Recommendation.find({ profileId }).sort({ score: -1 });
      const recExtIds = recs.map((r) => ({
        platform: r.platform,
        externalId: r.problemExternalId,
      }));
      const problemDocs =
        recExtIds.length > 0 ? await Problem.find({ $or: recExtIds }) : [];
      const problemMap = new Map(
        problemDocs.map((p) => [`${p.platform}:${p.externalId}`, p])
      );

      recommendations = recs.map((r) => {
        const p = problemMap.get(`${r.platform}:${r.problemExternalId}`);
        return {
          problem: p
            ? {
                platform: p.platform as "codeforces" | "leetcode",
                externalId: p.externalId,
                title: p.title,
                url: p.url,
                tags: p.tags,
                concepts: p.concepts,
                difficulty: p.difficulty,
                rating: p.rating,
              }
            : {
                platform: r.platform as "codeforces" | "leetcode",
                externalId: r.problemExternalId,
                title: "Unknown problem",
                url: "",
                tags: [],
                concepts: [r.concept],
              },
          score: r.score,
          reason: r.reason,
          concept: r.concept,
          type: r.type as "learn" | "practice" | "reinforce" | "challenge",
        };
      });
    }

    const hasCF = !!codeforcesProfile;
    const hasLC = !!leetcodeProfile;

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

    return NextResponse.json({
      profileId,
      codeforcesProfile,
      leetcodeProfile,
      conceptSkills,
      recommendations,
      blindSpots,
      codeforcesAnalysis,
      leetcodeAnalysis,
      progression: buildConceptProgression(conceptSkills),
    });
  } catch (error) {
    console.error("Analysis fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis" },
      { status: 500 }
    );
  }
}