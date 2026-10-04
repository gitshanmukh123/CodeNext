import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import {
  performAnalysis,
  getOrCreateProfile,
  persistAnalysisData,
} from "@/lib/analyze-service";
import {
  isDatabaseConfigured,
  storeAnalysis,
  deriveLocalProfileId,
} from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { codeforcesUsername, leetcodeUsername } = body;

    if (!codeforcesUsername && !leetcodeUsername) {
      return NextResponse.json(
        { error: "Please provide at least one username" },
        { status: 400 }
      );
    }

    const profileId = isDatabaseConfigured()
      ? await (async () => {
          await connectToDatabase();
          return getOrCreateProfile(codeforcesUsername, leetcodeUsername);
        })()
      : deriveLocalProfileId(codeforcesUsername, leetcodeUsername);

    const snapshot = await performAnalysis(
      profileId,
      codeforcesUsername,
      leetcodeUsername
    );

    if (!snapshot.codeforcesProfile && !snapshot.leetcodeProfile) {
      return NextResponse.json(
        { error: "Could not fetch any profile data", details: snapshot.errors },
        { status: 404 }
      );
    }

    if (isDatabaseConfigured()) {
      await persistAnalysisData(profileId, snapshot);
    } else {
      storeAnalysis(profileId, {
        profileId,
        codeforcesUsername: snapshot.codeforcesUsername,
        leetcodeUsername: snapshot.leetcodeUsername,
        codeforcesProfile: snapshot.codeforcesProfile,
        leetcodeProfile: snapshot.leetcodeProfile,
        conceptSkills: snapshot.conceptSkills,
        recommendations: snapshot.recommendations,
        blindSpots: snapshot.blindSpots,
        problems: snapshot.problems,
        submissions: snapshot.submissions,
        errors:
          snapshot.errors.length > 0 ? snapshot.errors : undefined,
      });
    }

    const solvedProblemIds = new Set(
      snapshot.submissions
        .filter((s) => s.verdict === "OK")
        .map((s) => `${s.platform}:${s.problemExternalId}`)
    );

    return NextResponse.json({
      success: true,
      profileId,
      codeforcesProfile: snapshot.codeforcesProfile,
      leetcodeProfile: snapshot.leetcodeProfile,
      conceptSkills: snapshot.conceptSkills,
      recommendations: snapshot.recommendations,
      blindSpots: snapshot.blindSpots,
      codeforcesAnalysis: snapshot.codeforcesAnalysis,
      leetcodeAnalysis: snapshot.leetcodeAnalysis,
      trending: snapshot.trending,
      stats: {
        totalProblems: snapshot.problems.length,
        totalSubmissions: snapshot.submissions.length,
        solvedProblems: solvedProblemIds.size,
      },
      errors:
        snapshot.errors.length > 0 ? snapshot.errors : undefined,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Internal server error during analysis" },
      { status: 500 }
    );
  }
}