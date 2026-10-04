import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Recommendation from "@/models/Recommendation";
import Problem from "@/models/Problem";
import { isDatabaseConfigured, getStoredAnalysis } from "@/lib/store";
import { generateRecommendations } from "@/lib/recommender";
import { Platform } from "@/types";

function enrichRec(
  rec: {
    _id?: unknown;
    score: number;
    reason: string;
    concept: string;
    type: string;
    problem?: {
      title?: string;
      platform?: string;
      difficulty?: string;
      rating?: number;
      url?: string;
      tags?: string[];
      concepts?: string[];
      externalId?: string;
    } | null;
  },
  fallbackTitle = "Unknown problem"
) {
  return {
    id: rec._id,
    score: rec.score,
    reason: rec.reason,
    concept: rec.concept,
    type: rec.type,
    problem: rec.problem
      ? {
          title: rec.problem.title || fallbackTitle,
          platform: rec.problem.platform,
          difficulty: rec.problem.difficulty || "unknown",
          rating: rec.problem.rating || 0,
          url: rec.problem.url,
          tags: rec.problem.tags || [],
          concepts: rec.problem.concepts || [rec.concept],
          externalId: rec.problem.externalId,
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const limit = parseInt(searchParams.get("limit") || "30");
    const platform = searchParams.get("platform") as Platform | null;

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    // In-memory fallback
    if (!isDatabaseConfigured()) {
      const stored = getStoredAnalysis(profileId);
      if (!stored) {
        return NextResponse.json(
          { error: "Profile not found. Run an analysis first." },
          { status: 404 }
        );
      }

      let recs =
        platform
          ? stored.recommendations.filter((r) => r.problem.platform === platform)
          : stored.recommendations;

      recs = recs.slice(0, limit);

      const enriched = recs.map((r) => ({
        id: undefined,
        score: r.score,
        reason: r.reason,
        concept: r.concept,
        type: r.type,
        problem: {
          title: r.problem.title,
          platform: r.problem.platform,
          difficulty: r.problem.difficulty || "unknown",
          rating: r.problem.rating || 0,
          url: r.problem.url,
          tags: r.problem.tags || [],
          concepts: r.problem.concepts,
          externalId: r.problem.externalId,
        },
      }));

      return NextResponse.json({ recommendations: enriched });
    }

    await connectToDatabase();

    const query: Record<string, unknown> = { profileId };
    if (platform) query.platform = platform;

    const recs = await Recommendation.find(query)
      .sort({ score: -1 })
      .limit(limit);

    const enriched = await Promise.all(
      recs.map(async (rec) => {
        const problem = await Problem.findOne({
          platform: rec.platform,
          externalId: rec.problemExternalId,
        });

        return enrichRec(
          {
            _id: rec._id,
            score: rec.score,
            reason: rec.reason,
            concept: rec.concept,
            type: rec.type,
            problem,
          },
          "Unknown problem"
        );
      })
    );

    return NextResponse.json({ recommendations: enriched });
  } catch (error) {
    console.error("Recommendations fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profileId, platform, excludeProblemIds, limit } =
      (await request.json()) as {
        profileId?: string;
        platform?: Platform;
        excludeProblemIds?: string[];
        limit?: number;
      };

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    const pageLimit = Math.min(Math.max(limit || 30, 1), 100);
    const exclude = new Set(excludeProblemIds || []);

    // Re-generate recommendations on demand (e.g. after the user marks
    // problems solved, or asks for a fresh batch) so freshness is preserved
    // even without a full re-analysis. Exclusions feed the recommender so a
    // "practice new problems" request never repeats a completed problem.
    const stored = isDatabaseConfigured() ? null : getStoredAnalysis(profileId);
    if (stored) {
      const solvedProblemIds = new Set(
        stored.submissions
          .filter((s) => s.verdict === "OK")
          .map((s) => `${s.platform}:${s.problemExternalId}`)
      );
      const fresh = generateRecommendations({
        problems: stored.problems,
        conceptSkills: stored.conceptSkills,
        solvedProblemIds,
        excludeProblemIds: exclude,
      });
      const filtered = platform
        ? fresh.filter((r) => r.problem.platform === platform)
        : fresh;
      return NextResponse.json({
        recommendations: filtered.slice(0, pageLimit).map((r) => ({
          id: undefined,
          score: r.score,
          reason: r.reason,
          concept: r.concept,
          type: r.type,
          problem: {
            title: r.problem.title,
            platform: r.problem.platform,
            difficulty: r.problem.difficulty || "unknown",
            rating: r.problem.rating || 0,
            url: r.problem.url,
            tags: r.problem.tags || [],
            concepts: r.problem.concepts,
            externalId: r.problem.externalId,
          },
        })),
      });
    }

    if (isDatabaseConfigured()) {
      const query: Record<string, unknown> = { profileId };
      if (platform) query.platform = platform;
      const recs = await Recommendation.find(query)
        .sort({ score: -1 })
        .limit(300);
      const enriched = (
        await Promise.all(
          recs.map(async (rec) => {
            const problem = await Problem.findOne({
              platform: rec.platform,
              externalId: rec.problemExternalId,
            });
            return enrichRec({ ...rec.toObject(), problem });
          })
        )
      ).filter((r) => {
        const key = `${r.problem?.platform}:${r.problem?.externalId}`;
        return !exclude.has(key);
      });
      return NextResponse.json({ recommendations: enriched.slice(0, pageLimit) });
    }

    return NextResponse.json(
      { error: "Profile not found. Run an analysis first." },
      { status: 404 }
    );
  } catch (error) {
    console.error("Recommendations regenerate error:", error);
    return NextResponse.json(
      { error: "Failed to regenerate recommendations" },
      { status: 500 }
    );
  }
}