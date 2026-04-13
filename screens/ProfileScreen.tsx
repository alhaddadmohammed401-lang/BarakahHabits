import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  session: Session;
}

interface Stats {
  currentStreak: number;
  bestStreak: number;
  totalCompleted: number;
}

// ── Storage Keys ─────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  STREAK: "barakah_streak",
  BEST_STREAK: "barakah_best_streak",
};

// ── Component ────────────────────────────────────────────────────────────────
export default function ProfileScreen({ session }: Props) {
  const userId = session?.user?.id;
  const userEmail = session?.user?.email ?? "Unknown";

  const [stats, setStats] = useState<Stats>({
    currentStreak: 0,
    bestStreak: 0,
    totalCompleted: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  // ── Load stats on mount ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      let currentStreak = 0;
      let bestStreak = 0;
      let totalCompleted = 0;

      // 1) Load current streak from AsyncStorage
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEYS.STREAK);
        if (saved) currentStreak = parseInt(saved, 10) || 0;

        const savedBest = await AsyncStorage.getItem(STORAGE_KEYS.BEST_STREAK);
        if (savedBest) bestStreak = parseInt(savedBest, 10) || 0;

        // Update best streak if current exceeds it
        if (currentStreak > bestStreak) {
          bestStreak = currentStreak;
          AsyncStorage.setItem(
            STORAGE_KEYS.BEST_STREAK,
            String(bestStreak)
          ).catch(() => {});
        }
      } catch {
        // ignore
      }

      // 2) Load total completed from Supabase
      try {
        const { count, error } = await supabase
          .from("habit_completions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        if (!error && count !== null) {
          totalCompleted = count;
        }
      } catch {
        // Supabase unavailable — show 0
      }

      if (cancelled) return;

      // 3) Calculate best streak from Supabase completion dates
      try {
        const { data, error } = await supabase
          .from("habit_completions")
          .select("completed_date")
          .eq("user_id", userId)
          .order("completed_date", { ascending: true });

        if (!error && data && data.length > 0) {
          // Get unique dates where all 5 habits were completed
          const dateCount: Record<string, number> = {};
          data.forEach((row: { completed_date: string }) => {
            dateCount[row.completed_date] =
              (dateCount[row.completed_date] || 0) + 1;
          });

          // Filter to dates with all 5 habits done
          const fullDays = Object.keys(dateCount)
            .filter((d) => dateCount[d] >= 5)
            .sort();

          // Calculate longest consecutive streak
          if (fullDays.length > 0) {
            let streak = 1;
            let maxStreak = 1;

            for (let i = 1; i < fullDays.length; i++) {
              const prev = new Date(fullDays[i - 1]);
              const curr = new Date(fullDays[i]);
              const diffMs = curr.getTime() - prev.getTime();
              const diffDays = diffMs / (1000 * 60 * 60 * 24);

              if (diffDays === 1) {
                streak++;
                if (streak > maxStreak) maxStreak = streak;
              } else {
                streak = 1;
              }
            }

            if (maxStreak > bestStreak) {
              bestStreak = maxStreak;
              AsyncStorage.setItem(
                STORAGE_KEYS.BEST_STREAK,
                String(bestStreak)
              ).catch(() => {});
            }
          }
        }
      } catch {
        // ignore
      }

      if (!cancelled) {
        setStats({ currentStreak, bestStreak, totalCompleted });
        setLoading(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Logout ─────────────────────────────────────────────────────────────
  function handleLogout() {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* ── Avatar & Email ──────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {userEmail.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.emailText}>{userEmail}</Text>
          <Text style={styles.memberSince}>
            Member since{" "}
            {new Date(session?.user?.created_at ?? "").toLocaleDateString(
              "en-US",
              {
                month: "long",
                year: "numeric",
              }
            )}
          </Text>
        </View>

        {/* ── Stats ───────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Your Progress</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.gold} />
            <Text style={styles.loadingText}>Loading stats...</Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            {/* Current Streak */}
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={styles.statNumber}>{stats.currentStreak}</Text>
              <Text style={styles.statLabel}>Current Streak</Text>
            </View>

            {/* Best Streak */}
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🏆</Text>
              <Text style={styles.statNumber}>{stats.bestStreak}</Text>
              <Text style={styles.statLabel}>Best Streak</Text>
            </View>

            {/* Total Completed */}
            <View style={[styles.statCard, styles.statCardWide]}>
              <Text style={styles.statEmoji}>✅</Text>
              <Text style={styles.statNumber}>{stats.totalCompleted}</Text>
              <Text style={styles.statLabel}>Habits Completed</Text>
            </View>
          </View>
        )}

        {/* ── Motivational Quote ──────────────────────────── */}
        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>
            "The most beloved deeds to Allah are the most consistent, even if
            they are small."
          </Text>
          <Text style={styles.quoteSource}>— Prophet Muhammad ﷺ</Text>
        </View>

        {/* ── Logout Button ───────────────────────────────── */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
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
  white: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.6)",
  cardBg: "rgba(255,255,255,0.08)",
  cardBorder: "rgba(255,255,255,0.1)",
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

  // ── Header ──────────────────────
  header: {
    marginTop: 20,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.gold,
    letterSpacing: 0.5,
  },

  // ── Profile Card ────────────────
  profileCard: {
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: "800",
    color: COLORS.primary,
  },
  emailText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // ── Section Title ───────────────
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
    marginBottom: 14,
    letterSpacing: 0.3,
  },

  // ── Loading ─────────────────────
  loadingBox: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 12,
    fontStyle: "italic",
  },

  // ── Stats Grid ──────────────────
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    paddingVertical: 22,
    marginBottom: 12,
  },
  statCardWide: {
    width: "100%",
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.gold,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
  },

  // ── Quote Card ──────────────────
  quoteCard: {
    backgroundColor: COLORS.goldLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212, 160, 23, 0.3)",
    padding: 20,
    marginBottom: 24,
  },
  quoteText: {
    fontSize: 15,
    fontStyle: "italic",
    color: COLORS.white,
    lineHeight: 22,
    marginBottom: 8,
  },
  quoteSource: {
    fontSize: 13,
    color: COLORS.gold,
    fontWeight: "600",
    textAlign: "right",
  },

  // ── Logout ──────────────────────
  logoutButton: {
    backgroundColor: "transparent",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.gold,
    paddingVertical: 16,
    alignItems: "center",
  },
  logoutText: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.gold,
    letterSpacing: 0.3,
  },
});
