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
import { supabase, calculateStreaks, getTodayKey } from "../lib/supabase";

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

// ── Storage Keys (for habit cache fallback only) ─────────────────────────────
const CACHE_KEY = "barakah_today_habits";

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

// ── Component ────────────────────────────────────────────────────────────────
export default function HomeScreen({ session }: Props) {
  const userId = session?.user?.id;

  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [streak, setStreak] = useState<number>(0);
  const [todayCompleted, setTodayCompleted] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const useSupabaseRef = useRef<boolean>(true);
  const syncingRef = useRef(false);

  const completedCount = habits.filter((h) => h.completed).length;
  const progress = completedCount / habits.length;

  // ── Load data on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const today = getTodayKey();

      // 1) Load today's completed habits from Supabase
      let completedIds: number[] = [];
      let supabaseWorked = false;

      try {
        const { data, error } = await supabase
          .from("habit_completions")
          .select("habit_id")
          .eq("user_id", userId)
          .eq("completed_date", today);

        if (!error && data) {
          completedIds = data.map((row: { habit_id: number }) => row.habit_id);
          supabaseWorked = true;

          // Cache to AsyncStorage as fallback
          AsyncStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ date: today, ids: completedIds })
          ).catch(() => {});
        }
      } catch {
        // Supabase unreachable
      }

      // 2) Fallback to AsyncStorage cache if Supabase failed
      if (!supabaseWorked) {
        useSupabaseRef.current = false;
        try {
          const cached = await AsyncStorage.getItem(CACHE_KEY);
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

      // 3) Apply completed states
      const allDone = completedIds.length === DEFAULT_HABITS.length;
      setHabits(
        DEFAULT_HABITS.map((h) => ({
          ...h,
          completed: completedIds.includes(h.id),
        }))
      );
      setTodayCompleted(allDone);

      // 4) Calculate streak from Supabase
      if (userId) {
        try {
          const streakResult = await calculateStreaks(userId);
          if (!cancelled) {
            setStreak(streakResult.currentStreak);
          }
        } catch {
          // streak stays at 0
        }
      }

      if (!cancelled) setLoaded(true);
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Sync a single habit toggle to Supabase ─────────────────────────────
  async function syncHabitToSupabase(habitId: number, completed: boolean) {
    const today = getTodayKey();

    if (!userId) return;

    if (completed) {
      const { error } = await supabase
        .from("habit_completions")
        .upsert(
          { user_id: userId, habit_id: habitId, completed_date: today },
          { onConflict: "user_id,habit_id,completed_date" }
        );
      if (error) {
        console.error("[SYNC] UPSERT ERROR:", error.message, error.code);
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("habit_completions")
        .delete()
        .eq("user_id", userId)
        .eq("habit_id", habitId)
        .eq("completed_date", today);
      if (error) {
        console.error("[SYNC] DELETE ERROR:", error.message);
        throw error;
      }
    }
  }

  // ── Cache habits locally as fallback ───────────────────────────────────
  function cacheHabitsLocally(updatedHabits: Habit[]) {
    const today = getTodayKey();
    const ids = updatedHabits.filter((h) => h.completed).map((h) => h.id);
    AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ date: today, ids })
    ).catch(() => {});
  }

  // ── Recalculate streak from Supabase ───────────────────────────────────
  async function refreshStreak() {
    if (!userId) return;
    try {
      const result = await calculateStreaks(userId);
      setStreak(result.currentStreak);
    } catch {
      // ignore
    }
  }

  // ── Toggle a habit & check if all 5 are done ───────────────────────────
  async function toggleHabit(id: number) {
    if (todayCompleted) return;
    if (syncingRef.current) return;

    // Compute new habit state
    const next = habits.map((h) =>
      h.id === id ? { ...h, completed: !h.completed } : h
    );
    const toggledHabit = next.find((h) => h.id === id)!;
    const allDone = next.every((h) => h.completed);

    // Update UI immediately
    setHabits(next);

    // Sync to backend
    syncingRef.current = true;
    setSyncing(true);
    try {
      if (useSupabaseRef.current) {
        await syncHabitToSupabase(id, toggledHabit.completed);
      }
      cacheHabitsLocally(next);
    } catch (e) {
      console.error("[TOGGLE] Sync FAILED:", e);
      useSupabaseRef.current = false;
      cacheHabitsLocally(next);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }

    if (allDone) {
      setTodayCompleted(true);

      // Recalculate streak from Supabase (the new completion is already saved)
      await refreshStreak();

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
            <View style={styles.habitEmoji}>
              <Text style={styles.emojiText}>{habit.emoji}</Text>
            </View>
            <Text
              style={[
                styles.habitLabel,
                habit.completed && styles.habitLabelCompleted,
              ]}
            >
              {habit.label}
            </Text>
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
