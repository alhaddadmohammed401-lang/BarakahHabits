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