import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────
interface Habit {
  id: number;
  label: string;
  emoji: string;
  completed: boolean;
}

interface Props {
  session: Session;
}

// ── Initial Data ─────────────────────────────────────────────────────────────
const DEFAULT_HABITS: Habit[] = [
  { id: 1, label: "Fajr on time", emoji: "🌅", completed: false },
  { id: 2, label: "Morning Adhkar", emoji: "🤲", completed: false },
  { id: 3, label: "Quran Reading", emoji: "📖", completed: false },
  { id: 4, label: "Evening Adhkar", emoji: "🌙", completed: false },
  { id: 5, label: "Isha on time", emoji: "🕌", completed: false },
];

// ── Storage Keys ─────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  STREAK: "barakah_streak",
  LAST_COMPLETED: "barakah_last_completed_date",
  TODAY_DONE: "barakah_today_done",
  TODAY_HABITS: "barakah_today_habits", // fallback cache
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getFormattedDate(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Returns "YYYY-MM-DD" for the current local date */
function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Returns "YYYY-MM-DD" for yesterday's local date */
function getYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Read from AsyncStorage with a timeout (ms).
 * Resolves to null if storage doesn't respond in time.
 */
function storageGetWithTimeout(
  key: string,
  timeoutMs: number = 3000
): Promise<string | null> {
  return Promise.race([
    AsyncStorage.getItem(key),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function HomeScreen({ session }: Props) {
  const userId = session?.user?.id;

  // DEBUG: Log session info on every render
  console.log("[HomeScreen] session exists:", !!session);
  console.log("[HomeScreen] user_id:", userId ?? "NULL — session has no user!");
  console.log("[HomeScreen] user email:", session?.user?.email ?? "N/A");

  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [streak, setStreak] = useState<number>(0);
  const [todayCompleted, setTodayCompleted] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const hasMountedRef = useRef(false);
  const useSupabaseRef = useRef<boolean>(true); // tracks if Supabase is reachable

  const completedCount = habits.filter((h) => h.completed).length;
  const progress = completedCount / habits.length;

  // ── Load data on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const today = getTodayKey();
      const yesterday = getYesterdayKey();

      // 1) Load streak from AsyncStorage (with timeout)
      let streakValue = 0;
      try {
        const [savedStreak, lastDate] = await Promise.all([
          storageGetWithTimeout(STORAGE_KEYS.STREAK),
          storageGetWithTimeout(STORAGE_KEYS.LAST_COMPLETED),
        ]);
        streakValue = savedStreak ? parseInt(savedStreak, 10) : 0;
        if (isNaN(streakValue)) streakValue = 0;
        // Reset streak if last completion was not today or yesterday
        if (lastDate && lastDate !== today && lastDate !== yesterday) {
          streakValue = 0;
        }
      } catch {
        // ignore
      }

      if (cancelled) return;
      setStreak(streakValue);

      // 2) Try loading today's completions from Supabase
      let completedIds: number[] = [];
      let supabaseWorked = false;

      try {
        console.log("[LOAD] Fetching from Supabase for user_id:", userId, "date:", today);
        const { data, error } = await supabase
          .from("habit_completions")
          .select("habit_id")
          .eq("user_id", userId)
          .eq("completed_date", today);

        console.log("[LOAD] Supabase SELECT response:", { data, error });

        if (error) {
          console.error("[LOAD] Supabase SELECT error:", error.message, error.details, error.hint);
        }

        if (!error && data) {
          completedIds = data.map((row: { habit_id: number }) => row.habit_id);
          supabaseWorked = true;
          console.log("[LOAD] Completed habit IDs from Supabase:", completedIds);

          // Cache to AsyncStorage as fallback
          AsyncStorage.setItem(
            STORAGE_KEYS.TODAY_HABITS,
            JSON.stringify({ date: today, ids: completedIds })
          ).catch(() => {});
        }
      } catch (e) {
        console.error("[LOAD] Supabase fetch CRASHED:", e);
      }

      // 3) If Supabase failed, try AsyncStorage fallback
      if (!supabaseWorked) {
        useSupabaseRef.current = false;
        try {
          const cached = await storageGetWithTimeout(STORAGE_KEYS.TODAY_HABITS);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.date === today && Array.isArray(parsed.ids)) {
              completedIds = parsed.ids;
            }
          }
        } catch {
          // ignore
        }
      }

      if (cancelled) return;

      // 4) Apply completed states
      const allDone = completedIds.length === DEFAULT_HABITS.length;
      setHabits(
        DEFAULT_HABITS.map((h) => ({
          ...h,
          completed: completedIds.includes(h.id),
        }))
      );
      setTodayCompleted(allDone);
      setLoaded(true);
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Persist streak whenever it changes (skip first render) ──────────────
  useEffect(() => {
    if (!loaded) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    AsyncStorage.setItem(STORAGE_KEYS.STREAK, String(streak)).catch(() => {});
  }, [streak, loaded]);

  // ── Sync a single habit toggle to Supabase ─────────────────────────────
  async function syncHabitToSupabase(habitId: number, completed: boolean) {
    const today = getTodayKey();

    console.log("[SYNC] ─── syncHabitToSupabase called ───");
    console.log("[SYNC] habit_id:", habitId);
    console.log("[SYNC] completed:", completed);
    console.log("[SYNC] user_id:", userId);
    console.log("[SYNC] date:", today);
    console.log("[SYNC] useSupabase:", useSupabaseRef.current);

    if (!userId) {
      console.error("[SYNC] ABORT — user_id is null/undefined! Session may be invalid.");
      return;
    }

    if (completed) {
      // Insert completion row
      const payload = {
        user_id: userId,
        habit_id: habitId,
        completed_date: today,
      };
      console.log("[SYNC] UPSERT payload:", JSON.stringify(payload));

      const { data, error } = await supabase
        .from("habit_completions")
        .upsert(payload, { onConflict: "user_id,habit_id,completed_date" })
        .select();

      console.log("[SYNC] UPSERT response data:", data);
      if (error) {
        console.error("[SYNC] UPSERT ERROR:", error.message);
        console.error("[SYNC] UPSERT error details:", error.details);
        console.error("[SYNC] UPSERT error hint:", error.hint);
        console.error("[SYNC] UPSERT error code:", error.code);
      } else {
        console.log("[SYNC] ✅ UPSERT SUCCESS for habit", habitId);
      }
    } else {
      // Delete completion row
      console.log("[SYNC] DELETE for habit_id:", habitId);

      const { data, error } = await supabase
        .from("habit_completions")
        .delete()
        .eq("user_id", userId)
        .eq("habit_id", habitId)
        .eq("completed_date", today)
        .select();

      console.log("[SYNC] DELETE response data:", data);
      if (error) {
        console.error("[SYNC] DELETE ERROR:", error.message);
        console.error("[SYNC] DELETE error details:", error.details);
      } else {
        console.log("[SYNC] ✅ DELETE SUCCESS for habit", habitId);
      }
    }
  }

  // ── Cache current habit state to AsyncStorage ──────────────────────────
  function cacheHabitsLocally(updatedHabits: Habit[]) {
    const today = getTodayKey();
    const ids = updatedHabits.filter((h) => h.completed).map((h) => h.id);
    AsyncStorage.setItem(
      STORAGE_KEYS.TODAY_HABITS,
      JSON.stringify({ date: today, ids })
    ).catch(() => {});
  }

  // ── Toggle a habit & check if all 5 are done ───────────────────────────
  const syncingRef = useRef(false);

  async function toggleHabit(id: number) {
    console.log("[TOGGLE] ─── TAP on habit", id, "───");
    console.log("[TOGGLE] todayCompleted:", todayCompleted);
    console.log("[TOGGLE] syncingRef:", syncingRef.current);

    if (todayCompleted) {
      console.log("[TOGGLE] BLOCKED — todayCompleted is true");
      return;
    }
    if (syncingRef.current) {
      console.log("[TOGGLE] BLOCKED — sync in progress");
      return;
    }

    // Compute new habit state
    const next = habits.map((h) =>
      h.id === id ? { ...h, completed: !h.completed } : h
    );
    const toggledHabit = next.find((h) => h.id === id)!;
    const allDone = next.every((h) => h.completed);

    // Update UI immediately
    setHabits(next);

    console.log("[TOGGLE] Habit", id, "→", toggledHabit.completed);
    console.log("[TOGGLE] allDone:", allDone);

    // Sync to backend
    syncingRef.current = true;
    setSyncing(true);
    try {
      if (useSupabaseRef.current) {
        await syncHabitToSupabase(id, toggledHabit.completed);
      } else {
        console.log("[TOGGLE] Skipping Supabase — offline mode");
      }
      cacheHabitsLocally(next);
    } catch (e) {
      console.error("[TOGGLE] Sync FAILED, switching to offline:", e);
      useSupabaseRef.current = false;
      cacheHabitsLocally(next);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }

    if (allDone) {
      const today = getTodayKey();

      setStreak((s) => s + 1);
      setTodayCompleted(true);

      AsyncStorage.setItem(STORAGE_KEYS.LAST_COMPLETED, today).catch(() => {});
      AsyncStorage.setItem(STORAGE_KEYS.TODAY_DONE, today).catch(() => {});

      setTimeout(() => {
        Alert.alert(
          "MashaAllah! 🎉",
          "You've completed all your habits today.\nMay Allah accept your efforts and grant you Barakah!",
          [{ text: "Alhamdulillah", style: "default" }]
        );
      }, 400);
    }
  }

  // ── Loading State ──────────────────────────────────────────────────────
  if (!loaded) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Loading your habits...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Greeting ─────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Assalamu Alaikum</Text>
          <Text style={styles.date}>{getFormattedDate()}</Text>
        </View>

        {/* ── Progress Ring ────────────────────────────────── */}
        <View style={styles.progressCard}>
          <View style={styles.progressCircleOuter}>
            <View
              style={[
                styles.progressCircleInner,
                progress === 1 && styles.progressComplete,
              ]}
            >
              <Text style={styles.progressText}>
                {completedCount}/{habits.length}
              </Text>
              <Text style={styles.progressLabel}>Done</Text>
            </View>
          </View>
          <Text style={styles.progressMessage}>
            {progress === 1
              ? "MashaAllah! All done today ✨"
              : progress >= 0.5
                ? "Keep going, you're doing great!"
                : "Start your day with Barakah"}
          </Text>
        </View>

        {/* ── Habit List ───────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Today's Habits</Text>

        {habits.map((habit) => (
          <TouchableOpacity
            key={habit.id}
            activeOpacity={0.7}
            onPress={() => toggleHabit(habit.id)}
            style={[
              styles.habitCard,
              habit.completed && styles.habitCardCompleted,
            ]}
          >
            {/* Emoji icon */}
            <View style={styles.habitEmoji}>
              <Text style={styles.emojiText}>{habit.emoji}</Text>
            </View>

            {/* Label */}
            <Text
              style={[
                styles.habitLabel,
                habit.completed && styles.habitLabelCompleted,
              ]}
            >
              {habit.label}
            </Text>

            {/* Checkbox / Syncing indicator */}
            <View
              style={[
                styles.checkbox,
                habit.completed && styles.checkboxChecked,
              ]}
            >
              {habit.completed && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
        ))}

        {/* ── Sync Status ──────────────────────────────────── */}
        {syncing && (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" color={COLORS.gold} />
            <Text style={styles.syncText}>Saving...</Text>
          </View>
        )}

        {!useSupabaseRef.current && loaded && (
          <View style={styles.offlineRow}>
            <Text style={styles.offlineText}>
              ☁️ Offline mode — data saved locally
            </Text>
          </View>
        )}

        {/* ── Streak Counter ───────────────────────────────── */}
        <View style={styles.streakCard}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <View style={styles.streakInfo}>
            <Text style={styles.streakCount}>{streak}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
          </View>
          <Text style={styles.streakMessage}>
            {streak === 0
              ? "Complete all habits today to start!"
              : `${streak} day${streak > 1 ? "s" : ""} of consistency!`}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const COLORS = {
  primary: "#1B4332",
  primaryLight: "#2D6A4F",
  gold: "#D4A017",
  goldLight: "rgba(212, 160, 23, 0.15)",
  surface: "#F8F5F0",
  white: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.6)",
  cardBg: "rgba(255,255,255,0.08)",
  cardBorder: "rgba(255,255,255,0.1)",
  completedBg: "rgba(212, 160, 23, 0.12)",
  completedBorder: "rgba(212, 160, 23, 0.3)",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // ── Loading ─────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 14,
    fontStyle: "italic",
  },

  // ── Header ──────────────────────
  header: {
    marginTop: 20,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  date: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 6,
    letterSpacing: 0.3,
  },

  // ── Progress ────────────────────
  progressCard: {
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 28,
    marginBottom: 28,
  },
  progressCircleOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: COLORS.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  progressCircleInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "rgba(212,160,23,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressComplete: {
    backgroundColor: "rgba(212,160,23,0.25)",
  },
  progressText: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.gold,
  },
  progressLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  progressMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontStyle: "italic",
  },

  // ── Section Title ───────────────
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
    marginBottom: 14,
    letterSpacing: 0.3,
  },

  // ── Habit Card ──────────────────
  habitCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    marginBottom: 10,
  },
  habitCardCompleted: {
    backgroundColor: COLORS.completedBg,
    borderColor: COLORS.completedBorder,
  },
  habitEmoji: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  emojiText: {
    fontSize: 20,
  },
  habitLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.white,
  },
  habitLabelCompleted: {
    color: COLORS.gold,
    textDecorationLine: "line-through",
    textDecorationColor: COLORS.gold,
  },

  // ── Checkbox ────────────────────
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },

  // ── Sync / Offline ──────────────
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  syncText: {
    fontSize: 13,
    color: COLORS.gold,
    marginLeft: 8,
  },
  offlineRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  offlineText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: "italic",
  },

  // ── Streak ──────────────────────
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.goldLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.completedBorder,
    padding: 18,
    marginTop: 18,
  },
  streakEmoji: {
    fontSize: 32,
    marginRight: 14,
  },
  streakInfo: {
    marginRight: 12,
  },
  streakCount: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.gold,
  },
  streakLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  streakMessage: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "right",
  },
});
