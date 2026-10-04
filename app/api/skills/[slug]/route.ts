import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Analysis from "@/models/Analysis";
import Problem from "@/models/Problem";
import Submission from "@/models/Submission";
import { CONCEPTS, getConceptByName, conceptToSlug } from "@/data/concepts";
import { getPrerequisites, getDependents } from "@/data/prerequisites";
import { isDatabaseConfigured, getStoredAnalysis } from "@/lib/store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    const conceptName = CONCEPTS.find(
      (c) => conceptToSlug(c.name) === slug
    )?.name;

    if (!conceptName) {
      return NextResponse.json(
        { error: "Concept not found" },
        { status: 404 }
      );
    }

    const prereqs = getPrerequisites(conceptName);
    const dependents = getDependents(conceptName);
    const conceptDef = getConceptByName(conceptName);

    if (isDatabaseConfigured()) {
      await connectToDatabase();

      const analysis = await Analysis.findOne({
        profileId,
        concept: conceptName,
      });

      const submissions = await Submission.find({ profileId });
      const solvedIds = submissions
        .filter((s) => s.verdict === "OK")
        .map((s) => `${s.platform}:${s.problemExternalId}`);

      const cfIds = solvedIds
        .filter((p) => p.startsWith("codeforces:"))
        .map((p) => p.split(":")[1]);
      const lcIds = solvedIds
        .filter((p) => p.startsWith("leetcode:"))
        .map((p) => p.split(":")[1]);

      const orConditions = [];
      if (cfIds.length > 0)
        orConditions.push({
          platform: "codeforces",
          externalId: { $in: cfIds },
        });
      if (lcIds.length > 0)
        orConditions.push({
          platform: "leetcode",
          externalId: { $in: lcIds },
        });

      const solvedProblems =
        orConditions.length > 0
          ? await Problem.find({ $or: orConditions })
          : [];

      const solvedInConcept = solvedProblems.filter((p) =>
        p.concepts.includes(conceptName)
      );

      const relatedAnalyses = await Analysis.find({
        profileId,
        concept: { $in: dependents },
      });

      return NextResponse.json({
        concept: conceptName,
        category: conceptDef?.category || "General",
        description: conceptDef?.description || "",
        importance: conceptDef?.importance || "basic",
        masteryScore: analysis?.masteryScore || 0,
        status: analysis?.status || "Unexplored",
        solvedCount: analysis?.solvedCount || 0,
        attemptedCount: analysis?.attemptedCount || 0,
        successRate: analysis?.successRate || 0,
        averageDifficulty: analysis?.averageDifficulty || 0,
        recentActivity: analysis?.recentActivity || null,
        codeforcesSolved: analysis?.codeforcesSolved || 0,
        leetcodeSolved: analysis?.leetcodeSolved || 0,
        prerequisites: prereqs,
        dependents,
        strong: relatedAnalyses
          .filter((a) => a.status === "Strong")
          .map((a) => a.concept),
        weak: relatedAnalyses
          .filter((a) => a.status === "Weak" || a.status === "Unexplored")
          .map((a) => a.concept),
        unexplored: relatedAnalyses
          .filter((a) => a.status === "Unexplored")
          .map((a) => a.concept),
        solvedProblems: solvedInConcept.slice(0, 10).map((p) => ({
          title: p.title,
          platform: p.platform,
          difficulty: p.difficulty,
          rating: p.rating,
          url: p.url,
        })),
      });
    }

    // In-memory fallback
    const stored = getStoredAnalysis(profileId);
    if (!stored) {
      return NextResponse.json(
        { error: "Profile not found. Run an analysis first." },
        { status: 404 }
      );
    }

    const skill = stored.conceptSkills.find((s) => s.concept === conceptName);

    const solvedProblemIds = new Set(
      stored.submissions
        .filter((s) => s.verdict === "OK")
        .map((s) => `${s.platform}:${s.problemExternalId}`)
    );

    const solvedInConcept = stored.problems.filter(
      (p) =>
        solvedProblemIds.has(`${p.platform}:${p.externalId}`) &&
        p.concepts.includes(conceptName)
    );

    const dependentSkills = stored.conceptSkills.filter((s) =>
      dependents.includes(s.concept)
    );

    return NextResponse.json({
      concept: conceptName,
      category: conceptDef?.category || "General",
      description: conceptDef?.description || "",
      importance: conceptDef?.importance || "basic",
      masteryScore: skill?.masteryScore || 0,
      status: skill?.status || "Unexplored",
      solvedCount: skill?.solvedCount || 0,
      attemptedCount: skill?.attemptedCount || 0,
      successRate: skill?.successRate || 0,
      averageDifficulty: skill?.averageDifficulty || 0,
      recentActivity: skill?.recentActivity || null,
      codeforcesSolved: skill?.codeforcesSolved || 0,
      leetcodeSolved: skill?.leetcodeSolved || 0,
      prerequisites: prereqs,
      dependents,
      strong: dependentSkills
        .filter((s) => s.status === "Strong")
        .map((s) => s.concept),
      weak: dependentSkills
        .filter((s) => s.status === "Weak" || s.status === "Unexplored")
        .map((s) => s.concept),
      unexplored: dependentSkills
        .filter((s) => s.status === "Unexplored")
        .map((s) => s.concept),
      solvedProblems: solvedInConcept.slice(0, 10).map((p) => ({
        title: p.title,
        platform: p.platform,
        difficulty: p.difficulty || "unknown",
        rating: p.rating || 0,
        url: p.url,
      })),
    });
  } catch (error) {
    console.error("Concept detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch concept details" },
      { status: 500 }
    );
  }
}