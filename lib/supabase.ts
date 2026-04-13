import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ylguudccnyhhlhwuhsub.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsZ3V1ZGNjbnloaGxod3Voc3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjY3MzQsImV4cCI6MjA5MTMwMjczNH0.FKLxFkqwNTXjZ8LnUUU6tCjnaI9I5q2V6ZcSN6Y4uRg";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  }
});

// ── Shared Streak Calculation ────────────────────────────────────────────────

export interface StreakResult {
  currentStreak: number;
  bestStreak: number;
  totalCompleted: number;
}

export interface BadgeProgress {
  id: string;
  emoji: string;
  title: string;
  condition: string;
  unlocked: boolean;
  unlockedDate: string | null;
  progress: number;
  progressText: string;
}

interface HabitCompletionRow {
  habit_id: number;
  completed_date: string;
  created_at: string | null;
}

interface QazaPrayerRow {
  count: number;
  updated_at: string | null;
}

const HABITS_PER_DAY = 5;
const HABIT_IDS = {
  fajrOnTime: 1,
  quranReading: 3,
  ishaOnTime: 5,
};

/**
 * Returns "YYYY-MM-DD" for a Date object (local time).
 */
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Returns "YYYY-MM-DD" for today (local time).
 */
export function getTodayKey(): string {
  return formatDate(new Date());
}

/**
 * Adds (or subtracts) days from a "YYYY-MM-DD" string and returns a new "YYYY-MM-DD".
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/**
 * Calculate streaks and total completions from the habit_completions table.
 *
 * Logic:
 * - A "full day" = a date where the user completed all 5 habits (5 rows).
 * - Current streak: count consecutive full days going backwards from today.
 *   If today is a full day, it counts. Then check yesterday, day before, etc.
 *   If today is NOT a full day, check if yesterday was — if yes, start streak
 *   from yesterday going backwards. If yesterday is also not full, streak = 0.
 * - Best streak: the longest run of consecutive full days ever.
 * - Total completed: total number of individual habit completion rows.
 */
export async function calculateStreaks(userId: string): Promise<StreakResult> {
  const result: StreakResult = {
    currentStreak: 0,
    bestStreak: 0,
    totalCompleted: 0,
  };

  try {
    // 1) Get total count of all completion rows
    const { count, error: countError } = await supabase
      .from("habit_completions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (!countError && count !== null) {
      result.totalCompleted = count;
    }

    // 2) Get all completion dates to calculate streaks
    const { data, error } = await supabase
      .from("habit_completions")
      .select("completed_date")
      .eq("user_id", userId)
      .order("completed_date", { ascending: true });

    if (error || !data || data.length === 0) {
      return result;
    }

    // 3) Count completions per date
    const dateCount: Record<string, number> = {};
    data.forEach((row: { completed_date: string }) => {
      dateCount[row.completed_date] = (dateCount[row.completed_date] || 0) + 1;
    });

    // 4) Get sorted list of "full days" (dates with all 5 habits completed)
    const fullDays = new Set(
      Object.keys(dateCount).filter((d) => dateCount[d] >= 5)
    );

    if (fullDays.size === 0) {
      return result;
    }

    const sortedFullDays = Array.from(fullDays).sort();

    // 5) Calculate BEST streak (longest consecutive run ever)
    let runLength = 1;
    let maxRun = 1;

    for (let i = 1; i < sortedFullDays.length; i++) {
      const expectedPrev = addDays(sortedFullDays[i], -1);
      if (expectedPrev === sortedFullDays[i - 1]) {
        runLength++;
        if (runLength > maxRun) maxRun = runLength;
      } else {
        runLength = 1;
      }
    }

    result.bestStreak = maxRun;

    // 6) Calculate CURRENT streak (consecutive full days ending at today or yesterday)
    const today = getTodayKey();
    const yesterday = addDays(today, -1);

    let startDate: string;
    if (fullDays.has(today)) {
      startDate = today;
    } else if (fullDays.has(yesterday)) {
      startDate = yesterday;
    } else {
      // Neither today nor yesterday is a full day — streak is 0
      result.currentStreak = 0;
      return result;
    }

    // Walk backwards from startDate counting consecutive full days
    let currentStreak = 1;
    let checkDate = addDays(startDate, -1);

    while (fullDays.has(checkDate)) {
      currentStreak++;
      checkDate = addDays(checkDate, -1);
    }

    result.currentStreak = currentStreak;

    // Update best streak if current exceeds it
    if (result.currentStreak > result.bestStreak) {
      result.bestStreak = result.currentStreak;
    }
  } catch (e) {
    console.error("[calculateStreaks] Error:", e);
  }

  return result;
}

/**
 * Keeps a number between 0 and 1 so progress bars never overflow.
 */
function clampProgress(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Converts a count and target into a reusable progress percentage.
 */
function getProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return clampProgress(current / target);
}

/**
 * Pulls a stable YYYY-MM-DD key from a Supabase date or timestamp.
 */
function getDateKey(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

/**
 * Builds a date-to-habits map so full-day badges can be calculated.
 */
function buildDateHabitMap(
  rows: HabitCompletionRow[]
): Record<string, Set<number>> {
  const dateHabitMap: Record<string, Set<number>> = {};

  rows.forEach((row) => {
    const dateKey = getDateKey(row.completed_date);
    if (!dateKey) return;

    if (!dateHabitMap[dateKey]) {
      dateHabitMap[dateKey] = new Set<number>();
    }

    dateHabitMap[dateKey].add(row.habit_id);
  });

  return dateHabitMap;
}

/**
 * Returns sorted dates where the user completed every daily habit.
 */
function getFullDayDates(dateHabitMap: Record<string, Set<number>>): string[] {
  return Object.keys(dateHabitMap)
    .filter((dateKey) => dateHabitMap[dateKey].size >= HABITS_PER_DAY)
    .sort();
}

/**
 * Returns sorted unique dates where one specific habit was completed.
 */
function getHabitDates(rows: HabitCompletionRow[], habitId: number): string[] {
  const dates = new Set<string>();

  rows.forEach((row) => {
    const dateKey = getDateKey(row.completed_date);
    if (row.habit_id === habitId && dateKey) {
      dates.add(dateKey);
    }
  });

  return Array.from(dates).sort();
}

/**
 * Finds the longest consecutive run in a sorted list of YYYY-MM-DD dates.
 */
function getLongestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  let currentRun = 1;
  let bestRun = 1;

  for (let i = 1; i < dates.length; i++) {
    const expectedPreviousDate = addDays(dates[i], -1);

    if (expectedPreviousDate === dates[i - 1]) {
      currentRun++;
      bestRun = Math.max(bestRun, currentRun);
    } else {
      currentRun = 1;
    }
  }

  return bestRun;
}

/**
 * Returns the date when a streak target was first reached.
 */
function getFirstStreakUnlockDate(
  dates: string[],
  target: number
): string | null {
  if (dates.length === 0 || target <= 0) return null;
  if (target === 1) return dates[0];

  let currentRun = 1;

  for (let i = 1; i < dates.length; i++) {
    const expectedPreviousDate = addDays(dates[i], -1);

    if (expectedPreviousDate === dates[i - 1]) {
      currentRun++;
    } else {
      currentRun = 1;
    }

    if (currentRun >= target) {
      return dates[i];
    }
  }

  return null;
}

/**
 * Finds the best single-day completion count for first-step progress.
 */
function getBestSingleDayCompletionCount(
  dateHabitMap: Record<string, Set<number>>
): number {
  return Object.values(dateHabitMap).reduce(
    (bestCount, habitSet) => Math.max(bestCount, habitSet.size),
    0
  );
}

/**
 * Finds the date when the total completion target was first reached.
 */
function getTotalCompletionUnlockDate(
  rows: HabitCompletionRow[],
  target: number
): string | null {
  if (rows.length < target) return null;

  const sortedRows = [...rows].sort((firstRow, secondRow) => {
    const firstDate = firstRow.created_at ?? firstRow.completed_date;
    const secondDate = secondRow.created_at ?? secondRow.completed_date;
    return firstDate.localeCompare(secondDate);
  });

  const targetRow = sortedRows[target - 1];
  return getDateKey(targetRow.created_at ?? targetRow.completed_date);
}

/**
 * Finds the latest Qaza update date for the Qaza Free badge.
 */
function getQazaFreeUnlockDate(rows: QazaPrayerRow[]): string {
  if (rows.length === 0) return getTodayKey();

  const sortedDates = rows
    .map((row) => getDateKey(row.updated_at))
    .filter((dateKey): dateKey is string => Boolean(dateKey))
    .sort();

  return sortedDates[sortedDates.length - 1] ?? getTodayKey();
}

/**
 * Builds one badge object with consistent unlock and progress fields.
 */
function createBadge(params: {
  id: string;
  emoji: string;
  title: string;
  condition: string;
  unlockDate: string | null;
  progressValue: number;
  progressText: string;
}): BadgeProgress {
  const unlocked = Boolean(params.unlockDate);

  return {
    id: params.id,
    emoji: params.emoji,
    title: params.title,
    condition: params.condition,
    unlocked,
    unlockedDate: params.unlockDate,
    progress: unlocked ? 1 : params.progressValue,
    progressText: unlocked ? "Unlocked" : params.progressText,
  };
}

/**
 * Loads habit and Qaza data from Supabase, then calculates every badge.
 */
export async function getBadgeProgress(userId: string): Promise<BadgeProgress[]> {
  const { data: completionData, error: completionError } = await supabase
    .from("habit_completions")
    .select("habit_id, completed_date, created_at")
    .eq("user_id", userId);

  if (completionError) {
    throw new Error(`Could not load habit completions: ${completionError.message}`);
  }

  const { data: qazaData, error: qazaError } = await supabase
    .from("qaza_prayers")
    .select("count, updated_at")
    .eq("user_id", userId);

  if (qazaError) {
    throw new Error(`Could not load Qaza prayers: ${qazaError.message}`);
  }

  const habitRows = (completionData ?? []) as HabitCompletionRow[];
  const qazaRows = (qazaData ?? []) as QazaPrayerRow[];

  const dateHabitMap = buildDateHabitMap(habitRows);
  const fullDayDates = getFullDayDates(dateHabitMap);
  const fajrDates = getHabitDates(habitRows, HABIT_IDS.fajrOnTime);
  const quranDates = getHabitDates(habitRows, HABIT_IDS.quranReading);
  const ishaDates = getHabitDates(habitRows, HABIT_IDS.ishaOnTime);

  const bestFullDayStreak = getLongestStreak(fullDayDates);
  const bestFajrStreak = getLongestStreak(fajrDates);
  const bestQuranStreak = getLongestStreak(quranDates);
  const bestIshaStreak = getLongestStreak(ishaDates);
  const bestSingleDayCount = getBestSingleDayCompletionCount(dateHabitMap);
  const totalCompleted = habitRows.length;
  const totalQazaOwed = qazaRows.reduce(
    (totalCount, row) => totalCount + row.count,
    0
  );

  const firstStepUnlockDate = fullDayDates[0] ?? null;
  const qazaUnlockDate =
    totalQazaOwed === 0 ? getQazaFreeUnlockDate(qazaRows) : null;

  return [
    createBadge({
      id: "early-bird",
      emoji: "🌅",
      title: "Early Bird",
      condition: "Complete Fajr on time 7 days in a row",
      unlockDate: getFirstStreakUnlockDate(fajrDates, 7),
      progressValue: getProgress(bestFajrStreak, 7),
      progressText: `${Math.min(bestFajrStreak, 7)}/7 days`,
    }),
    createBadge({
      id: "on-fire",
      emoji: "🔥",
      title: "On Fire",
      condition: "Reach a 7 day streak",
      unlockDate: getFirstStreakUnlockDate(fullDayDates, 7),
      progressValue: getProgress(bestFullDayStreak, 7),
      progressText: `${Math.min(bestFullDayStreak, 7)}/7 days`,
    }),
    createBadge({
      id: "unstoppable",
      emoji: "⚡",
      title: "Unstoppable",
      condition: "Reach a 30 day streak",
      unlockDate: getFirstStreakUnlockDate(fullDayDates, 30),
      progressValue: getProgress(bestFullDayStreak, 30),
      progressText: `${Math.min(bestFullDayStreak, 30)}/30 days`,
    }),
    createBadge({
      id: "diamond-deen",
      emoji: "💎",
      title: "Diamond Deen",
      condition: "Reach a 100 day streak",
      unlockDate: getFirstStreakUnlockDate(fullDayDates, 100),
      progressValue: getProgress(bestFullDayStreak, 100),
      progressText: `${Math.min(bestFullDayStreak, 100)}/100 days`,
    }),
    createBadge({
      id: "first-step",
      emoji: "✅",
      title: "First Step",
      condition: "Complete all 5 habits for the first time",
      unlockDate: firstStepUnlockDate,
      progressValue: getProgress(bestSingleDayCount, HABITS_PER_DAY),
      progressText: `${Math.min(bestSingleDayCount, HABITS_PER_DAY)}/5 habits`,
    }),
    createBadge({
      id: "night-warrior",
      emoji: "🌙",
      title: "Night Warrior",
      condition: "Complete Isha on time 30 days in a row",
      unlockDate: getFirstStreakUnlockDate(ishaDates, 30),
      progressValue: getProgress(bestIshaStreak, 30),
      progressText: `${Math.min(bestIshaStreak, 30)}/30 days`,
    }),
    createBadge({
      id: "quran-keeper",
      emoji: "📖",
      title: "Quran Keeper",
      condition: "Complete Quran Reading 30 days in a row",
      unlockDate: getFirstStreakUnlockDate(quranDates, 30),
      progressValue: getProgress(bestQuranStreak, 30),
      progressText: `${Math.min(bestQuranStreak, 30)}/30 days`,
    }),
    createBadge({
      id: "century",
      emoji: "🏆",
      title: "Century",
      condition: "Complete 100 total habits",
      unlockDate: getTotalCompletionUnlockDate(habitRows, 100),
      progressValue: getProgress(totalCompleted, 100),
      progressText: `${Math.min(totalCompleted, 100)}/100 habits`,
    }),
    createBadge({
      id: "elite",
      emoji: "👑",
      title: "Elite",
      condition: "Complete 500 total habits",
      unlockDate: getTotalCompletionUnlockDate(habitRows, 500),
      progressValue: getProgress(totalCompleted, 500),
      progressText: `${Math.min(totalCompleted, 500)}/500 habits`,
    }),
    createBadge({
      id: "qaza-free",
      emoji: "🕌",
      title: "Qaza Free",
      condition: "Bring all Qaza counts to 0",
      unlockDate: qazaUnlockDate,
      progressValue: totalQazaOwed === 0 ? 1 : 0,
      progressText: `${totalQazaOwed} qaza left`,
    }),
  ];
}
