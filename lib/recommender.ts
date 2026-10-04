import {
  NormalizedProblem,
  RecommendationItem,
  ConceptSkill,
  Platform,
  ConceptProgression,
} from "@/types";
import { getPrerequisites, getDependents } from "@/data/prerequisites";
import { getConceptImportance } from "./concepts-mapper";
import { getEffectiveRating } from "./analyzer";

const DAY = 24 * 60 * 60 * 1000;

export function getProblemKey(problem: {
  platform: Platform;
  externalId: string;
}): string {
  return `${problem.platform}:${problem.externalId}`;
}

export function getTodayKey(offsetDays = 0): string {
  return new Date(Date.now() - offsetDays * DAY).toISOString().split("T")[0];
}

/** Remaining prerequisites that are NOT yet strong for this user. */
export function getMissingPrerequisites(
  concept: string,
  skillMap: Map<string, ConceptSkill>
): string[] {
  const prereqs = getPrerequisites(concept);
  return prereqs.filter((pr) => {
    const skill = skillMap.get(pr);
    return !skill || skill.status !== "Strong";
  });
}

/**
 * Builds a full concept->progression view used by the roadmap page.
 * Orders concepts by whether prerequisites are met, then status, then
 * mastery, so the user always sees a sensible "learn this next" order.
 */
export function buildConceptProgression(
  conceptSkills: ConceptSkill[]
): ConceptProgression[] {
  const skillMap = new Map<string, ConceptSkill>();
  for (const skill of conceptSkills) skillMap.set(skill.concept, skill);

  const progression: ConceptProgression[] = conceptSkills.map((skill) => {
    const prereqs = getPrerequisites(skill.concept);
    const prerequisitesMet = prereqs.every((pr) => {
      const s = skillMap.get(pr);
      return s && s.status === "Strong";
    });
    return {
      concept: skill.concept,
      category: skill.category,
      masteryScore: skill.masteryScore,
      status: skill.status,
      prerequisites: prereqs,
      dependents: getDependents(skill.concept),
      prerequisitesMet,
      cfSolved: skill.codeforcesSolved,
      lcSolved: skill.leetcodeSolved,
      solvedCount: skill.solvedCount,
      recentActivity: skill.recentActivity,
    };
  });

  const order: Record<string, number> = {
    Unexplored: 0,
    Weak: 1,
    Developing: 2,
    Strong: 3,
  };

  progression.sort((a, b) => {
    // Concepts whose prerequisites are met come before blocked ones.
    if (a.prerequisitesMet !== b.prerequisitesMet) {
      return a.prerequisitesMet ? -1 : 1;
    }
    // Weaker concepts first.
    if (order[a.status] !== order[b.status]) {
      return order[a.status] - order[b.status];
    }
    return a.masteryScore - b.masteryScore;
  });

  return progression;
}

interface RecommendationInput {
  problems: NormalizedProblem[];
  conceptSkills: ConceptSkill[];
  solvedProblemIds: Set<string>;
  /**
   * Problems to never recommend, in addition to solved ones. This is how the
   * app enforces "never repeat a problem I already practiced": the caller can
   * feed in every problem the user has ever seen/completed (from the local
   * roadmap history), no matter how far back.
   */
  excludeProblemIds?: Set<string>;
}

/**
 * Improved recommendation engine.
 *
 * Ordering principles (most important first):
 *  1. READINESS:  problems whose concept prerequisites are ALREADY strong are
 *                 pushed up; recommendable even when the concept is unexplored.
 *  2. WEAKNESS:   weak / unexplored concepts get priority (they raise mastery
 *                 the fastest).
 *  3. DIFFICULTY FIT: the "sweet spot" is slightly above the user's current
 *                 demonstrated level per platform, never far above or far below.
 *  4. DIVERSITY:  platforms are balanced ~50/50 and no single concept is
 *                 recommended more than 3 times.
 */
export function generateRecommendations(input: RecommendationInput): RecommendationItem[] {
  const { problems, conceptSkills, solvedProblemIds, excludeProblemIds } = input;

  const skillMap = new Map<string, ConceptSkill>();
  for (const skill of conceptSkills) skillMap.set(skill.concept, skill);

  // Per-platform demonstrated level derived from the average effective rating
  // of the problems the user has actually SOLVED on that platform.
  const cfLevel = averageSolvedRating(problems, solvedProblemIds, "codeforces");
  const lcLevel = averageSolvedRating(problems, solvedProblemIds, "leetcode");

  const weakConcepts = conceptSkills
    .filter(
      (s) => s.status === "Weak" || s.status === "Unexplored"
    )
    .sort((a, b) => a.masteryScore - b.masteryScore);

  const strongConceptSet = new Set(
    conceptSkills.filter((s) => s.status === "Strong").map((s) => s.concept)
  );

  const conceptCount: Record<string, number> = {};
  const platformCount: Record<Platform, number> = { codeforces: 0, leetcode: 0 };
  const recommendations: RecommendationItem[] = [];

  for (const problem of problems) {
    const problemKey = getProblemKey(problem);
    if (solvedProblemIds.has(problemKey)) continue;
    if (excludeProblemIds && excludeProblemIds.has(problemKey)) continue;

    for (const concept of problem.concepts) {
      const skill = skillMap.get(concept);
      const score = scoreRecommendation(
        problem,
        concept,
        skill,
        weakConcepts,
        strongConceptSet,
        conceptCount,
        platformCount,
        cfLevel,
        lcLevel
      );

      if (score > 0) {
        const reason = generateReason(concept, skill, problem);
        const type = determineRecommendationType(concept, skill);
        recommendations.push({ problem, score, reason, concept, type });
      }
    }
  }

  recommendations.sort((a, b) => b.score - a.score);

  const selected: RecommendationItem[] = [];
  const usedProblems = new Set<string>();
  const usedConcepts = new Set<string>();

  for (const rec of recommendations) {
    const key = getProblemKey(rec.problem);
    if (usedProblems.has(key)) continue;

    const pc = conceptCount[rec.concept] || 0;
    if (pc >= 3) continue;

    usedProblems.add(key);
    conceptCount[rec.concept] = pc + 1;
    platformCount[rec.problem.platform]++;
    usedConcepts.add(rec.concept);
    selected.push(rec);

    // Stop when both platforms are well represented and we have enough picks.
    if (selected.length >= 30) break;
  }

  return selected;
}

/**
 * Same engine as generateRecommendations but restricted to one platform.
 * Uses platform-specific difficulty curves so a Codeforces-only user still
 * gets sensible CF picks and a LeetCode-only user sensible LC picks.
 */
export function generatePlatformRecommendations(
  input: RecommendationInput,
  platform: Platform
): RecommendationItem[] {
  const all = generateRecommendations(input);
  return all.filter((r) => r.problem.platform === platform);
}

function averageSolvedRating(
  problems: NormalizedProblem[],
  solvedProblemIds: Set<string>,
  platform: Platform
): number {
  let sum = 0;
  let count = 0;
  for (const p of problems) {
    if (p.platform !== platform) continue;
    if (!solvedProblemIds.has(getProblemKey(p))) continue;
    const r = getEffectiveRating(p);
    if (r > 0) {
      sum += r;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function difficultyFitScore(
  problem: NormalizedProblem,
  level: number
): number {
  const rating = getEffectiveRating(problem);
  if (!rating) {
    return problem.difficulty === "easy"
      ? 10
      : problem.difficulty === "medium"
        ? 8
        : 5;
  }

  // Sweet spot: within [-150, +350] of the user's demonstrated level.
  if (level <= 0) {
    // Unknown level -> prefer the easiest problems up to a sane rating.
    if (rating <= 1200) return 15;
    if (rating <= 1600) return 12;
    return 6;
  }

  const diff = rating - level;
  if (diff >= -150 && diff <= 200) return 20;  // perfect stretch
  if (diff >= -300 && diff <= 400) return 14;  // still comfortable
  if (diff < -300) return 5;                    // too easy, low learning value
  if (diff <= 650) return 8;                    // hard but worth attempting
  return 3;                                     // too hard
}

function scoreRecommendation(
  problem: NormalizedProblem,
  concept: string,
  skill: ConceptSkill | undefined,
  weakConcepts: ConceptSkill[],
  strongConceptSet: Set<string>,
  conceptCount: Record<string, number>,
  platformCount: Record<Platform, number>,
  cfLevel: number,
  lcLevel: number
): number {
  let score = 0;
  const prereqs = getPrerequisites(concept);
  const importance = getConceptImportance(concept);

  // 1. READINESS — missing prerequisites on an advanced concept are the
  //    single biggest mistake a beginner makes. Gate hard.
  const missingPrereqs = prereqs.filter((pr) => !strongConceptSet.has(pr));
  if (missingPrereqs.length > 0 && prereqs.length === 1) {
    score -= 30;
  } else if (missingPrereqs.length > 0) {
    score -= 20;
  }

  // 2. CONCEPT STATE — reward targeting weak/unexplored areas.
  const isWeak = weakConcepts.some((w) => w.concept === concept);
  if (isWeak) score += 40;
  else if (skill && skill.status === "Developing") score += 22;
  else if (strongConceptSet.has(concept)) score += 8;
  else score += 12;

  // Unexplored concepts get a bonus scaled by importance (fundamentals first).
  const isUnexplored = skill?.status === "Unexplored";
  if (isUnexplored) {
    if (importance === "basic") score += 25;
    else if (importance === "intermediate") score += 14;
    else score += 6;
  }

  // 3. DIFFICULTY FIT per platform.
  const level = problem.platform === "codeforces" ? cfLevel : lcLevel;
  score += difficultyFitScore(problem, level);

  // % solved on that platform boosts that platform's picks so a Codeforces
  // regular isn't drowned in LeetCode links.
  const solvedOnPlatform =
    problem.platform === "codeforces"
      ? Math.min(skill?.codeforcesSolved || 0, 10)
      : Math.min(skill?.leetcodeSolved || 0, 10);
  score += Math.round(solvedOnPlatform * 0.6);

  // Penalty for concepts we've already stacked picks on.
  score -= (conceptCount[concept] || 0) * 4;

  // Mild platform-balancing: whichever platform has fewer picks right now
  // gains a small edge so a workout is rarely 100% one platform.
  const pTotal = platformCount[problem.platform] || 0;
  const otherTotal =
    problem.platform === "codeforces"
      ? platformCount.leetcode || 0
      : platformCount.codeforces || 0;
  if (pTotal > 0 && otherTotal < pTotal) score += 6;

  // Multi-concept problems are inherently more interesting.
  if (new Set(problem.concepts).size > 1) score += 5;

  return Math.max(score, 0);
}

function generateReason(
  concept: string,
  skill: ConceptSkill | undefined,
  problem: NormalizedProblem
): string {
  const difficulty = problem.difficulty
    ? ` (${problem.difficulty})`
    : "";

  if (!skill || skill.status === "Unexplored") {
    return `You haven't practiced ${concept} yet. This ${difficulty.trim() || "problem"} is a friendly starting point — solve it to establish your foundation.`;
  }

  if (skill.status === "Weak") {
    return `Your ${concept} mastery is low (${skill.masteryScore}%)${difficulty}. This problem is a focused step toward improving it.`;
  }

  if (skill.status === "Developing") {
    return `You're making progress in ${concept} (${skill.masteryScore}%)${difficulty}. This problem pushes you to strengthen it further.`;
  }

  return `You're strong in ${concept}${difficulty}. This is a challenge problem to keep sharpening your edge.`;
}

function determineRecommendationType(
  concept: string,
  skill: ConceptSkill | undefined
): "learn" | "practice" | "reinforce" | "challenge" {
  if (!skill || skill.status === "Unexplored") return "learn";
  if (skill.status === "Weak") return "practice";
  if (skill.status === "Developing") return "reinforce";
  return "challenge";
}

export interface DailyPlanOptions {
  excludeProblemIds?: Set<string>;
  date?: string;
  balancePlatforms?: boolean;
  platform?: Platform;
}

export interface DailyPlanProblem {
  problem: NormalizedProblem;
  concept: string;
  type: "learn" | "practice" | "reinforce" | "challenge";
  reason: string;
}

export interface DailyPlan {
  date: string;
  problems: DailyPlanProblem[];
}

/**
 * Builds today's plan with clear rules the user can understand:
 *  1. NO-REPEAT  — problems already seen/solved in the last 7 days are dropped.
 *  2. WARM-UP    — the easiest, most reachable problem comes first.
 *  3. WEAK FOCUS — the strongest remaining weak/unexplored concept leads the plan.
 *  4. TOP-UP     — fill to 5 with the best remaining pick, alternating
 *                  Codeforces and LeetCode so the day always has a mixed workout.
 */
export function generateDailyPlan(
  recommendations: RecommendationItem[],
  options?: DailyPlanOptions
): DailyPlan {
  const {
    excludeProblemIds = new Set<string>(),
    date = getTodayKey(),
    balancePlatforms = true,
    platform,
  } = options || {};

  let pool = shuffle(recommendations).sort((a, b) => b.score - a.score);

  if (platform) {
    pool = pool.filter((r) => r.problem.platform === platform);
  }

  pool = pool.filter((r) => !excludeProblemIds.has(getProblemKey(r.problem)));

  const selected: DailyPlanProblem[] = [];
  const used = new Set<string>();
  const usedConcepts = new Set<string>();

  const ratingOf = (r: RecommendationItem) => getEffectiveRating(r.problem) || 1200;

  // 1. Warm-up: easiest reachable problem (never too hard to start).
  const warmups = [...pool].sort((a, b) => ratingOf(a) - ratingOf(b));
  const warmup = warmups.find(
    (r) => !used.has(getProblemKey(r.problem)) && !usedConcepts.has(r.concept)
  );
  if (warmup) {
    selected.push(toPlanProblem(warmup));
    used.add(getProblemKey(warmup.problem));
    usedConcepts.add(warmup.concept);
  }

  // 2. Weak-focus: strongest-scoring weak/unexplored/developing concept.
  const focusOrder = pool.filter((r) =>
    ["learn", "practice", "reinforce"].includes(r.type)
  );
  const focus = focusOrder.find(
    (r) => !used.has(getProblemKey(r.problem)) && !usedConcepts.has(r.concept)
  );
  if (focus) {
    selected.push(toPlanProblem(focus));
    used.add(getProblemKey(focus.problem));
    usedConcepts.add(focus.concept);
  }

  // 3. Top-up with platform balancing, rotated by the day-of-year.
  const platformKeys: Platform[] =
    platform ? [platform] : ["codeforces", "leetcode"];
  const start = dayOfYear(new Date());
  const ordered = rotate([...pool], start % Math.max(pool.length, 1));
  let cursor = start % Math.max(platformKeys.length, 1);

  while (selected.length < 5 && cursor < 60) {
    const target = platformKeys[cursor % platformKeys.length];
    const candidate = ordered.find(
      (r) =>
        r.problem.platform === target &&
        !used.has(getProblemKey(r.problem)) &&
        !usedConcepts.has(r.concept)
    );
    if (candidate) {
      selected.push(toPlanProblem(candidate));
      used.add(getProblemKey(candidate.problem));
      usedConcepts.add(candidate.concept);
    }
    cursor++;

    // Fallback: if no problem left for the required platform, pick any.
    if (selected.length < 5 && cursor % platformKeys.length === 0) {
      const anyPool = ordered.find(
        (r) => !used.has(getProblemKey(r.problem)) && !usedConcepts.has(r.concept)
      );
      if (!anyPool) break;
      selected.push(toPlanProblem(anyPool));
      used.add(getProblemKey(anyPool.problem));
      usedConcepts.add(anyPool.concept);
    }
  }

  // Guarantee platform mix when the pool has both platforms.
  if (balancePlatforms && !platform) {
    const platformCount = new Map<Platform, number>();
    for (const p of selected) {
      platformCount.set(
        p.problem.platform,
        (platformCount.get(p.problem.platform) || 0) + 1
      );
    }
    const missing = platformKeys.filter((k) => !platformCount.has(k));
    if (missing.length > 0 && selected.length > 1) {
      const replacement = pool.find(
        (r) =>
          missing.includes(r.problem.platform) &&
          !used.has(getProblemKey(r.problem))
      );
      if (replacement) {
        // Drop the weakest of the dominant platform and swap in the missing one.
        const dominant = selected.filter((p) =>
          platformCount.get(p.problem.platform)! > 1
        );
        const idx = selected.indexOf(dominant[dominant.length - 1]);
        if (idx >= 0) {
          selected[idx] = toPlanProblem(replacement);
        }
      }
    }
  }

  return { date, problems: selected.slice(0, 5) };
}

function toPlanProblem(rec: RecommendationItem): DailyPlanProblem {
  return {
    problem: rec.problem,
    concept: rec.concept,
    type: rec.type,
    reason: rec.reason,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / DAY);
}

function rotate<T>(arr: T[], n: number): T[] {
  if (arr.length === 0) return arr;
  const k = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

export interface WeeklyPlanOptions {
  excludeProblemIds?: Set<string>;
  balancePlatforms?: boolean;
  startDate?: string;
  platform?: Platform;
}

export interface WeeklyPlan {
  startDate: string;
  days: {
    day: string;
    theme: string;
    problems: DailyPlanProblem[];
  }[];
}

/**
 * Builds a 7-day roadmap organized by a simple learning story:
 *  Mon–Wed attack weak/unexplored concepts, Thu focuses on developing ones,
 *  Fri is mixed practice, Sat is a challenge, Sun is a review/assessment.
 *  Each day keeps a Codeforces + LeetCode mix when possible.
 *
 * The focus concepts are intersected with the problems actually available
 * (after the optional platform filter) so a day is only "about" a concept the
 * planner can actually source off that platform. Days are filled from the best
 * remaining problems, never left dangling when the pool has picks available.
 */
export function generateWeeklyPlan(
  conceptSkills: ConceptSkill[],
  recommendations: RecommendationItem[],
  options?: WeeklyPlanOptions
): WeeklyPlan {
  const {
    excludeProblemIds = new Set<string>(),
    balancePlatforms = true,
    startDate: startDateOverride,
    platform,
  } = options || {};

  const today = new Date();
  const monday = startDateOverride
    ? new Date(startDateOverride)
    : (() => {
        const d = new Date(today);
        d.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        return d;
      })();

  const pool = platform
    ? recommendations.filter((r) => r.problem.platform === platform)
    : [...recommendations];

  // Only concepts that actually have a problem in the (possibly filtered) pool.
  const poolConceptCounts = new Map<string, number>();
  for (const rec of pool) {
    poolConceptCounts.set(rec.concept, (poolConceptCounts.get(rec.concept) || 0) + 1);
  }
  const hasPoolProblem = (concept: string) => (poolConceptCounts.get(concept) || 0) > 0;

  const weakConcepts = conceptSkills
    .filter((s) => (s.status === "Weak" || s.status === "Unexplored") && hasPoolProblem(s.concept))
    .sort((a, b) => a.masteryScore - b.masteryScore);

  const developingConcepts = conceptSkills
    .filter((s) => s.status === "Developing" && hasPoolProblem(s.concept))
    .sort((a, b) => a.masteryScore - b.masteryScore);

  const allFocus = [...weakConcepts, ...developingConcepts];

  // Fallback: if no weak/developing concept has a problem in the pool, lead
  // with whatever concepts the pool does contain.
  const fallbackFromPool = [...poolConceptCounts.keys()]
    .map((c) => conceptSkills.find((s) => s.concept === c))
    .filter((s): s is ConceptSkill => !!s && (s.status === "Weak" || s.status === "Unexplored" || s.status === "Developing"));

  const focusList = allFocus.length > 0 ? allFocus : fallbackFromPool;

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const leadName = focusList[0]?.concept || "";

  const baseThemes = [
    leadName ? `Start With ${leadName}` : "Fundamentals & Weak Areas",
    "Weak Concept Focus",
    "Weak Concept Reinforcement",
    "Developing Concepts",
    "Mixed Practice",
    "Challenge Day",
    "Weekly Assessment",
  ];

  const recByConcept = new Map<string, RecommendationItem[]>();
  for (const rec of pool) {
    if (!recByConcept.has(rec.concept)) recByConcept.set(rec.concept, []);
    recByConcept.get(rec.concept)!.push(rec);
  }

  const usedWeekly = new Set<string>(excludeProblemIds);
  const ratingOf = (r: RecommendationItem) => getEffectiveRating(r.problem) || 1200;

  // Spread the pool across the week so a modest filtered set still fills
  // multiple days instead of dumping everything into Monday.
  const perDayCapacity = Math.min(3, Math.max(1, Math.round(pool.length / 5)));

  const days = daysOfWeek.map((day, i) => {
    const theme = baseThemes[i];

    const leadConcept =
      i === 0 ? focusList[0]?.concept
        : i === 1 ? focusList[1]?.concept
          : i === 2 ? focusList[2]?.concept
            : i === 3 ? developingConcepts[0]?.concept
              : i === 4 ? allFocus[0]?.concept
                : undefined;

    const dayProblems: DailyPlanProblem[] = [];
    const usedToday = new Set<string>();

    const take = (rec: RecommendationItem) => {
      dayProblems.push(toPlanProblem(rec));
      usedToday.add(getProblemKey(rec.problem));
      usedWeekly.add(getProblemKey(rec.problem));
    };

    const available = () =>
      pool.filter((r) => !usedWeekly.has(getProblemKey(r.problem)));

    // 1. Lead the day with its focus concept when that concept has problems.
    if (leadConcept) {
      const pick = (recByConcept.get(leadConcept) || [])
        .filter((r) => !usedWeekly.has(getProblemKey(r.problem)))
        .sort((a, b) => b.score - a.score)[0];
      if (pick) take(pick);
    }

    // Saturday is the challenge: lead with the hardest available problem.
    if (i === 5) {
      const challenge = available().sort((a, b) => ratingOf(b) - ratingOf(a))[0];
      if (challenge && !usedToday.has(getProblemKey(challenge.problem))) take(challenge);
    }

    // Sunday is a lighter review: lead with the easiest available problem.
    if (i === 6) {
      const review = available().sort((a, b) => ratingOf(a) - ratingOf(b))[0];
      if (review && !usedToday.has(getProblemKey(review.problem))) take(review);
    }

    // 2. Fill the day up to its capacity from the best remaining problems,
    //    alternating platforms while a mixed pool is available.
    let guard = 0;
    while (dayProblems.length < perDayCapacity && guard < pool.length + 1) {
      guard++;
      const remaining = available();
      if (remaining.length === 0) break;

      // Avoid immediately stacking two of the same platform in a mixed week.
      const next = balancePlatforms && !platform && dayProblems.length > 0
        ? remaining.find((r) => r.problem.platform !== dayProblems[0].problem.platform)
          || remaining[0]
        : remaining[0];
      take(next);
    }

    return {
      day,
      theme,
      problems: dayProblems,
    };
  });

  return {
    startDate: monday.toISOString().split("T")[0],
    days,
  };
}

export function findBlindSpots(
  conceptSkills: ConceptSkill[]
): Array<{
  concept: string;
  category: string;
  priority: "Critical" | "High" | "Medium";
  reason: string;
  masteryScore: number;
}> {
  const skillMap = new Map<string, ConceptSkill>();
  for (const skill of conceptSkills) skillMap.set(skill.concept, skill);

  const blindSpots: Array<{
    concept: string;
    category: string;
    priority: "Critical" | "High" | "Medium";
    reason: string;
    masteryScore: number;
  }> = [];

  for (const skill of conceptSkills) {
    if (skill.status === "Unexplored") {
      const importance = getConceptImportance(skill.concept);

      // Readiness amplifies urgency: an unexplored concept with no
      // prerequisites is a more critical gap than a highly-gated one.
      const prereqsMet = getPrerequisites(skill.concept).every((pr) => {
        const s = skillMap.get(pr);
        return s && s.status === "Strong";
      });

      let priority: "Critical" | "High" | "Medium";
      if (importance === "basic" && prereqsMet) priority = "Critical";
      else if (importance === "basic") priority = "High";
      else if (importance === "intermediate" && prereqsMet) priority = "High";
      else priority = "Medium";

      const gate = prereqsMet
        ? " Its prerequisites are already strong, so there's nothing in the way."
        : "";

      blindSpots.push({
        concept: skill.concept,
        category: skill.category,
        priority,
        reason: `You haven't practiced ${skill.concept} at all.${
          gate
        } This is a ${importance}-level concept.`,
        masteryScore: 0,
      });
    } else if (skill.status === "Weak") {
      blindSpots.push({
        concept: skill.concept,
        category: skill.category,
        priority: skill.masteryScore < 15 ? "Critical" : "High",
        reason: `Low mastery (${skill.masteryScore}%) with only ${skill.solvedCount} solved problem${skill.solvedCount === 1 ? "" : "s"}.`,
        masteryScore: skill.masteryScore,
      });
    }
  }

  const priorityOrder = { Critical: 0, High: 1, Medium: 2 };
  blindSpots.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return blindSpots;
}