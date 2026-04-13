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
import { supabase, calculateStreaks, StreakResult } from "../lib/supabase";
import { useRevenueCat } from "../hooks/useRevenueCat";
import RevenueCatUI from "react-native-purchases-ui";

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  session: Session;
  navigation: any;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ProfileScreen({ session, navigation }: Props) {
  const userId = session?.user?.id;
  const userEmail = session?.user?.email ?? "Unknown";
  const { isPremium } = useRevenueCat();

  const [stats, setStats] = useState<StreakResult>({
    currentStreak: 0,
    bestStreak: 0,
    totalCompleted: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  // ── Load stats on mount ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const result = await calculateStreaks(userId);
        if (!cancelled) {
          setStats(result);
        }
      } catch {
        // Supabase unavailable — stats stay at 0
      }

      if (!cancelled) setLoading(false);
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
          {!isPremium && (
            <TouchableOpacity 
              style={styles.premiumButton}
              onPress={() => navigation.navigate("Paywall")}
            >
              <Text style={styles.premiumIcon}>👑</Text>
            </TouchableOpacity>
          )}
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
              <Text style={styles.statUnit}>days</Text>
              <Text style={styles.statLabel}>Current Streak</Text>
            </View>

            {/* Best Streak */}
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🏆</Text>
              <Text style={styles.statNumber}>{stats.bestStreak}</Text>
              <Text style={styles.statUnit}>days</Text>
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

        {/* ── Go Premium / Manage Sub ─────────────────────── */}
        {!isPremium ? (
          <TouchableOpacity
            style={styles.premiumBigButton}
            onPress={() => navigation.navigate("Paywall")}
            activeOpacity={0.8}
          >
            <Text style={styles.premiumBigText}>Go Premium 👑</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.premiumBigButton}
            onPress={() => RevenueCatUI.presentCustomerCenter()}
            activeOpacity={0.8}
          >
            <Text style={styles.premiumBigText}>Manage Subscription ⚙️</Text>
          </TouchableOpacity>
        )}

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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  premiumButton: {
    backgroundColor: COLORS.cardBg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.goldLight,
  },
  premiumIcon: {
    fontSize: 22,
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
  statUnit: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.gold,
    opacity: 0.7,
    marginTop: -2,
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

  // ── Premium Link ────────────────
  premiumBigButton: {
    backgroundColor: COLORS.goldLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.gold,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  premiumBigText: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.gold,
    letterSpacing: 0.3,
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
