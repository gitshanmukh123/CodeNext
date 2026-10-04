import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Analysis from "@/models/Analysis";
import Recommendation from "@/models/Recommendation";
import {
  getAIInsights,
  getAIStudyAdvice,
  getAIConceptExplanation,
} from "@/lib/ai";
import {
  isDatabaseConfigured,
  getStoredAnalysis,
} from "@/lib/store";
import { ConceptSkill, RecommendationItem } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, type, concept } = body;

    if (type === "concept") {
      if (!concept) {
        return NextResponse.json(
          { error: "concept is required" },
          { status: 400 }
        );
      }

      let skill: ConceptSkill | null = null;

      if (profileId) {
        if (isDatabaseConfigured()) {
          await connectToDatabase();
          const analysis = await Analysis.findOne({
            profileId,
            concept: { $regex: new RegExp(`^${concept.replace(/ /g, " ")}`, "i") },
          });

          if (analysis) {
            skill = {
              profileId: analysis.profileId,
              concept: analysis.concept,
              category: analysis.category,
              solvedCount: analysis.solvedCount,
              attemptedCount: analysis.attemptedCount,
              successRate: analysis.successRate,
              averageDifficulty: analysis.averageDifficulty,
              averageAttempts: analysis.averageAttempts,
              recentActivity: analysis.recentActivity,
              masteryScore: analysis.masteryScore,
              status: analysis.status as "Strong" | "Developing" | "Weak" | "Unexplored",
              codeforcesSolved: analysis.codeforcesSolved,
              leetcodeSolved: analysis.leetcodeSolved,
            };
          }
        } else {
          const stored = getStoredAnalysis(profileId);
          const found = stored?.conceptSkills.find(
            (s) => s.concept.toLowerCase() === concept.toLowerCase()
          );
          if (found) {
            skill = found;
          }
        }
      }

      const explanation = await getAIConceptExplanation(concept, skill);
      return NextResponse.json({ explanation });
    }

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    let conceptSkills: ConceptSkill[] = [];
    let recommendations: RecommendationItem[] = [];

    if (isDatabaseConfigured()) {
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
      recommendations = recs.map((r) => ({
        problem: {
          platform: r.platform as "codeforces" | "leetcode",
          externalId: r.problemExternalId,
          title: "",
          url: "",
          tags: [],
          concepts: [r.concept],
        },
        score: r.score,
        reason: r.reason,
        concept: r.concept,
        type: r.type as "learn" | "practice" | "reinforce" | "challenge",
      }));
    } else {
      const stored = getStoredAnalysis(profileId);
      if (!stored) {
        return NextResponse.json(
          { error: "Profile not found. Run an analysis first." },
          { status: 404 }
        );
      }
      conceptSkills = stored.conceptSkills;
      recommendations = stored.recommendations;
    }

    if (type === "advice") {
      const advice = await getAIStudyAdvice(conceptSkills);
      return NextResponse.json({ advice });
    }

    const insights = await getAIInsights(conceptSkills, recommendations);
    return NextResponse.json({ insights });
  } catch (error) {
    console.error("AI route error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI content" },
      { status: 500 }
    );
  }
}