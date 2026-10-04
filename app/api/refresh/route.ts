import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import {
  performAnalysis,
  persistAnalysisData,
} from "@/lib/analyze-service";
import {
  isDatabaseConfigured,
  getStoredAnalysis,
  storeAnalysis,
} from "@/lib/store";
import Profile from "@/models/Profile";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    let codeforcesUsername: string | undefined;
    let leetcodeUsername: string | undefined;

    if (isDatabaseConfigured()) {
      await connectToDatabase();
      const profile = await Profile.findById(profileId);
      if (!profile) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 }
        );
      }
      codeforcesUsername = profile.codeforcesUsername;
      leetcodeUsername = profile.leetcodeUsername;
    } else {
      const stored = getStoredAnalysis(profileId);
      if (!stored) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 }
        );
      }
      codeforcesUsername = stored.codeforcesUsername;
      leetcodeUsername = stored.leetcodeUsername;
    }

    const snapshot = await performAnalysis(
      profileId,
      codeforcesUsername,
      leetcodeUsername
    );

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

    return NextResponse.json({
      success: true,
      conceptSkills: snapshot.conceptSkills,
      recommendations: snapshot.recommendations.length,
      errors:
        snapshot.errors.length > 0 ? snapshot.errors : undefined,
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh data" },
      { status: 500 }
    );
  }
}