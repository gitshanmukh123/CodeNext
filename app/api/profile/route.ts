import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Profile from "@/models/Profile";
import {
  isDatabaseConfigured,
  findStoredByUsernames,
} from "@/lib/store";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cf = searchParams.get("codeforces");
    const lc = searchParams.get("leetcode");

    if (!cf && !lc) {
      return NextResponse.json(
        { error: "Provide codeforces or leetcode username" },
        { status: 400 }
      );
    }

    // In-memory fallback: search by username match
    if (!isDatabaseConfigured()) {
      const stored = findStoredByUsernames(cf || undefined, lc || undefined);
      if (!stored) {
        return NextResponse.json(
          { error: "Profile not found. Run an analysis first." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        profileId: stored.profileId,
        codeforcesUsername: stored.codeforcesUsername || "",
        leetcodeUsername: stored.leetcodeUsername || "",
        codeforcesRating: stored.codeforcesProfile?.rating || 0,
        codeforcesMaxRating: stored.codeforcesProfile?.maxRating || 0,
        codeforcesRank: stored.codeforcesProfile?.rank || "",
        leetcodeTotalSolved: stored.leetcodeProfile?.totalSolved || 0,
        leetcodeEasySolved: stored.leetcodeProfile?.easySolved || 0,
        leetcodeMediumSolved: stored.leetcodeProfile?.mediumSolved || 0,
        leetcodeHardSolved: stored.leetcodeProfile?.hardSolved || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await connectToDatabase();

    const query: Record<string, string> = {};
    if (cf) query.codeforcesUsername = cf.toLowerCase();
    if (lc) query.leetcodeUsername = lc.toLowerCase();

    const profile = await Profile.findOne(query);

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      profileId: profile._id,
      codeforcesUsername: profile.codeforcesUsername,
      leetcodeUsername: profile.leetcodeUsername,
      codeforcesRating: profile.codeforcesRating,
      codeforcesMaxRating: profile.codeforcesMaxRating,
      codeforcesRank: profile.codeforcesRank,
      leetcodeTotalSolved: profile.leetcodeTotalSolved,
      leetcodeEasySolved: profile.leetcodeEasySolved,
      leetcodeMediumSolved: profile.leetcodeMediumSolved,
      leetcodeHardSolved: profile.leetcodeHardSolved,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}