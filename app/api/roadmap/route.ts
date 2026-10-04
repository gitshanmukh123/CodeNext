import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Analysis from "@/models/Analysis";
import Recommendation from "@/models/Recommendation";
import Problem from "@/models/Problem";
import {
  generateDailyPlan,
  generateWeeklyPlan,
  buildConceptProgression,
} from "@/lib/recommender";
import { isDatabaseConfigured, getStoredAnalysis } from "@/lib/store";
import { ConceptSkill, RecommendationItem, Platform } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const platform = searchParams.get("platform") as Platform | null;

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    let conceptSkills: ConceptSkill[] = [];
    let recommendations: RecommendationItem[] = [];

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
    } else {
      await connectToDatabase();
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

      const recs = await Recommendation.find({ profileId }).sort({ score: -1 });
      const recExtIds = recs.map((r) => ({
        platform: r.platform,
        externalId: r.problemExternalId,
      }));

      const problemDocs =
        recExtIds.length > 0
          ? await Problem.find({ $or: recExtIds })
          : [];

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

    // Apply platform filter (used by /codeforces and /leetcode pages).
    if (platform) {
      recommendations = recommendations.filter(
        (r) => r.problem.platform === platform
      );
    }

    const dailyPlan = generateDailyPlan(recommendations, {
      platform: platform || undefined,
    });
    const weeklyPlan = generateWeeklyPlan(conceptSkills, recommendations, {
      platform: platform || undefined,
    });
    const progression = buildConceptProgression(conceptSkills);

    return NextResponse.json({
      dailyPlan,
      weeklyPlan,
      recommendations,
      conceptSkills,
      progression,
      platform,
    });
  } catch (error) {
    console.error("Roadmap fetch error:", error);
    return NextResponse.json(
      { error: "Failed to generate roadmap" },
      { status: 500 }
    );
  }
}