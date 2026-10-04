import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Analysis from "@/models/Analysis";
import { CONCEPTS } from "@/data/concepts";
import { isDatabaseConfigured, getStoredAnalysis } from "@/lib/store";

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

    let analyses: Array<{
      concept: string;
      masteryScore: number;
      status: string;
      solvedCount: number;
      attemptedCount: number;
      successRate: number;
      averageDifficulty: number;
      recentActivity: string | null;
      codeforcesSolved: number;
      leetcodeSolved: number;
    }> = [];

    if (isDatabaseConfigured()) {
      await connectToDatabase();
      analyses = await Analysis.find({ profileId }).sort({ masteryScore: -1 });
    } else {
      const stored = getStoredAnalysis(profileId);
      if (!stored) {
        return NextResponse.json(
          { error: "Profile not found. Run an analysis first." },
          { status: 404 }
        );
      }
      analyses = stored.conceptSkills;
    }

    const allConcepts = CONCEPTS.map((c) => {
      const analysis = analyses.find((a) => a.concept === c.name);
      return {
        concept: c.name,
        category: c.category,
        description: c.description,
        importance: c.importance,
        masteryScore: analysis?.masteryScore || 0,
        status: analysis?.status || "Unexplored",
        solvedCount: analysis?.solvedCount || 0,
        attemptedCount: analysis?.attemptedCount || 0,
        successRate: analysis?.successRate || 0,
        averageDifficulty: analysis?.averageDifficulty || 0,
        recentActivity: analysis?.recentActivity || null,
        codeforcesSolved: analysis?.codeforcesSolved || 0,
        leetcodeSolved: analysis?.leetcodeSolved || 0,
      };
    });

    const categoryMastery: Record<string, number> = {};
    const categoryMap: Record<string, number[]> = {};
    for (const c of allConcepts) {
      if (!categoryMap[c.category]) categoryMap[c.category] = [];
      categoryMap[c.category].push(c.masteryScore);
    }
    for (const [cat, scores] of Object.entries(categoryMap)) {
      categoryMastery[cat] = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      );
    }

    const overall =
      allConcepts.length > 0
        ? Math.round(
            allConcepts.reduce((a, c) => a + c.masteryScore, 0) /
              allConcepts.length
          )
        : 0;

    return NextResponse.json({
      overallMastery: overall,
      categoryMastery,
      concepts: allConcepts,
    });
  } catch (error) {
    console.error("Skills fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch skills" },
      { status: 500 }
    );
  }
}