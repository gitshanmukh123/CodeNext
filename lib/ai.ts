import { ConceptSkill, RecommendationItem } from "@/types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface AIInsight {
  observation: string;
  category: "strength" | "weakness" | "pattern" | "recommendation";
}

export async function getAIInsights(
  conceptSkills: ConceptSkill[],
  recommendations: RecommendationItem[]
): Promise<AIInsight[]> {
  if (!OPENAI_API_KEY) {
    return getDefaultInsights(conceptSkills);
  }

  try {
    const strong = conceptSkills
      .filter((s) => s.status === "Strong")
      .map((s) => `${s.concept}: ${s.masteryScore}%`)
      .join(", ");

    const weak = conceptSkills
      .filter((s) => s.status === "Weak")
      .map((s) => `${s.concept}: ${s.masteryScore}%`)
      .join(", ");

    const unexplored = conceptSkills
      .filter((s) => s.status === "Unexplored")
      .map((s) => s.concept)
      .join(", ");

    const topRecs = recommendations
      .slice(0, 5)
      .map((r) => `${r.concept} (${r.type})`)
      .join(", ");

    const prompt = `Analyze this competitive programmer's profile and give 3-5 concise observations.

Strong concepts: ${strong || "none yet"}
Weak concepts: ${weak || "none yet"}
Unexplored concepts: ${unexplored || "none yet"}
Top recommended focus areas: ${topRecs || "none yet"}

Return JSON array with objects having "observation" (string) and "category" (one of: "strength", "weakness", "pattern", "recommendation"). Keep each observation under 30 words. Be specific and actionable.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return getDefaultInsights(conceptSkills);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) return getDefaultInsights(conceptSkills);

    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map((item: AIInsight) => ({
        observation: item.observation || "",
        category: item.category || "recommendation",
      }));
    }

    return getDefaultInsights(conceptSkills);
  } catch {
    return getDefaultInsights(conceptSkills);
  }
}

function getDefaultInsights(skills: ConceptSkill[]): AIInsight[] {
  const insights: AIInsight[] = [];
  const strong = skills.filter((s) => s.status === "Strong");
  const weak = skills.filter(
    (s) => s.status === "Weak" || s.status === "Unexplored"
  );

  if (strong.length > 0) {
    insights.push({
      observation: `Strong in ${strong[0].concept} with ${strong[0].masteryScore}% mastery. Use this as a foundation to learn related advanced concepts.`,
      category: "strength",
    });
  }

  if (weak.length > 0) {
    insights.push({
      observation: `${weak[0].concept} is a gap in your skills. Prioritize this area to become a more well-rounded programmer.`,
      category: "weakness",
    });
  }

  if (skills.length > 0) {
    const overall = Math.round(
      skills.reduce((a, s) => a + s.masteryScore, 0) / skills.length
    );
    insights.push({
      observation: `Overall mastery: ${overall}%. Focus on converting "Weak" concepts to "Developing" for the biggest improvement.`,
      category: "pattern",
    });
  }

  insights.push({
    observation: "Solve at least 2-3 problems daily from your weak areas for consistent improvement.",
    category: "recommendation",
  });

  return insights;
}

export async function getAIConceptExplanation(
  concept: string,
  skill: ConceptSkill | null
): Promise<string> {
  if (!OPENAI_API_KEY) {
    return getDefaultConceptExplanation(concept, skill);
  }

  try {
    const skillContext = skill
      ? `The user has ${skill.solvedCount} solved problems, ${skill.successRate}% success rate, and ${skill.masteryScore}% mastery in this concept.`
      : "The user hasn't practiced this concept yet.";

    const prompt = `Explain the DSA concept "${concept}" to a competitive programmer.
${skillContext}

Provide:
1. What it is (1-2 sentences)
2. Why it matters in competitive programming
3. Key problem types that use it
4. What prerequisites to learn first

Keep it concise and practical. Under 150 words.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return getDefaultConceptExplanation(concept, skill);

    const data = await response.json();
    return data.choices?.[0]?.message?.content || getDefaultConceptExplanation(concept, skill);
  } catch {
    return getDefaultConceptExplanation(concept, skill);
  }
}

function getDefaultConceptExplanation(
  concept: string,
  skill: ConceptSkill | null
): string {
  const status = skill
    ? `You have ${skill.masteryScore}% mastery with ${skill.solvedCount} solved problems.`
    : "You haven't practiced this yet.";

  return `${concept} is a fundamental data structures and algorithms concept. ${status} Focus on understanding the core idea, practice 5-10 problems at increasing difficulty, and review edge cases.`;
}

export async function getAIRecommendationExplanation(
  recommendation: RecommendationItem,
  skill: ConceptSkill | null
): Promise<string> {
  if (!OPENAI_API_KEY) {
    return recommendation.reason;
  }

  try {
    const prompt = `Explain why this problem was recommended for a competitive programmer.
Problem: ${recommendation.problem.title} (${recommendation.problem.platform})
Concept: ${recommendation.concept}
Type: ${recommendation.type}
${skill ? `User mastery in ${recommendation.concept}: ${skill.masteryScore}%` : "User hasn't practiced this concept."}

Give a 2-3 sentence personalized explanation. Be encouraging and specific.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return recommendation.reason;

    const data = await response.json();
    return data.choices?.[0]?.message?.content || recommendation.reason;
  } catch {
    return recommendation.reason;
  }
}

export async function getAIStudyAdvice(
  conceptSkills: ConceptSkill[]
): Promise<string[]> {
  if (!OPENAI_API_KEY) {
    return getDefaultStudyAdvice(conceptSkills);
  }

  try {
    const skillsSummary = conceptSkills
      .filter((s) => s.status !== "Unexplored")
      .map(
        (s) =>
          `${s.concept}: ${s.status} (${s.masteryScore}%, ${s.solvedCount} solved)`
      )
      .join("\n");

    const prompt = `Based on this skill profile, give 3-5 specific study advice items:
${skillsSummary}

Each advice should be one actionable sentence. Focus on what to study this week.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return getDefaultStudyAdvice(conceptSkills);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      return content
        .split("\n")
        .filter((l: string) => l.trim())
        .slice(0, 5);
    }

    return getDefaultStudyAdvice(conceptSkills);
  } catch {
    return getDefaultStudyAdvice(conceptSkills);
  }
}

function getDefaultStudyAdvice(skills: ConceptSkill[]): string[] {
  const weak = skills.filter((s) => s.status === "Weak");
  const advice: string[] = [];

  if (weak.length > 0) {
    advice.push(
      `Focus on ${weak[0].concept} this week - solve 5-10 problems starting from easy difficulty.`
    );
  }

  advice.push("Review problems you got wrong and understand the editorial solutions.");
  advice.push("Practice timed problem solving to improve speed under pressure.");
  advice.push("Alternate between learning new concepts and reinforcing existing ones.");

  return advice;
}
