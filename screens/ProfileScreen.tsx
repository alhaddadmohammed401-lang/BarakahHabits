import React, { useState, useEffect, useRef } from "react";
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
import {
  supabase,
  calculateStreaks,
  getHabitCompletionHeatmap,
  HabitHeatmapDay,
  StreakResult,
} from "../lib/supabase";
import { useRevenueCat } from "../hooks/useRevenueCat";
import RevenueCatUI from "react-native-purchases-ui";

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  session: Session;
  navigation: any;
}

interface HeatmapColumn {
  columnKey: string;
  days: HabitHeatmapDay[];
}

interface MonthLabelSection {
  monthLabel: string;
  columnCount: number;
}

const HEATMAP_SQUARE_SIZE = 10;
const HEATMAP_SQUARE_GAP = 3;
const HEATMAP_COLUMN_WIDTH = HEATMAP_SQUARE_SIZE + HEATMAP_SQUARE_GAP;
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Splits 365 heatmap days into vertical week-like columns from oldest to newest.
 */
function buildHeatmapColumns(days: HabitHeatmapDay[]): HeatmapColumn[] {
  const columns: HeatmapColumn[] = [];
  const orderedDays = [...days].sort((firstDay, secondDay) =>
    firstDay.date.localeCompare(secondDay.date)
  );

  for (let startIndex = 0; startIndex < orderedDays.length; startIndex += 7) {
    columns.push({
      columnKey: orderedDays[startIndex].date,
      days: orderedDays.slice(startIndex, startIndex + 7),
    });
  }

  return columns;
}

/**
 * Reads the month number from a YYYY-MM-DD date key.
 */
function getMonthIndex(dateKey: string): number {
  const parsedDate = new Date(`${dateKey}T00:00:00`);
  return parsedDate.getMonth();
}

/**
 * Groups adjacent heatmap columns by month for the label row.
 */
function buildMonthLabelSections(
  columns: HeatmapColumn[]
): MonthLabelSection[] {
  const sections: MonthLabelSection[] = [];

  columns.forEach((column) => {
    const monthLabel = MONTH_LABELS[getMonthIndex(column.columnKey)];
    const previousSection = sections[sections.length - 1];

    if (previousSection?.monthLabel === monthLabel) {
      previousSection.columnCount++;
    } else {
      sections.push({ monthLabel, columnCount: 1 });
    }
  });

  return sections;
}

/**
 * Chooses the heatmap color level for a day's completion count.
 */
function getHeatmapSquareStyle(completionCount: number) {
  if (completionCount >= 5) return styles.heatmapFull;
  if (completionCount >= 3) return styles.heatmapMedium;
  if (completionCount >= 1) return styles.heatmapLight;
  return styles.heatmapEmpty;
}

/**
 * Builds a screen-reader label for one heatmap square.
 */
function getHeatmapSquareLabel(day: HabitHeatmapDay): string {
  return `${day.date}: ${day.completionCount} of 5 habits completed`;
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
  const [heatmapDays, setHeatmapDays] = useState<HabitHeatmapDay[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState<boolean>(true);
  const [heatmapError, setHeatmapError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const heatmapColumns = buildHeatmapColumns(heatmapDays);
  const monthLabelSections = buildMonthLabelSections(heatmapColumns);
  const heatmapScrollRef = useRef<ScrollView>(null);

  // ── Load stats on mount ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadProfileData() {
      if (!userId) {
        setLoading(false);
        setHeatmapLoading(false);
        return;
      }

      setLoading(true);
      setHeatmapLoading(true);
      setHeatmapError(null);

      const [statsResult, heatmapResult] = await Promise.allSettled([
        calculateStreaks(userId),
        getHabitCompletionHeatmap(userId),
      ]);

      if (cancelled) return;

      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value);
      }

      if (heatmapResult.status === "fulfilled") {
        setHeatmapDays(heatmapResult.value);
      } else {
        const message =
          heatmapResult.reason instanceof Error
            ? heatmapResult.reason.message
            : "Could not load yearly habit data.";
        setHeatmapError(message);
      }

      setLoading(false);
      setHeatmapLoading(false);

    }

    loadProfileData();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Auto-scroll heatmap to show today (rightmost) ─────────────────────
  useEffect(() => {
    if (!heatmapLoading && heatmapDays.length > 0) {
      setTimeout(() => {
        heatmapScrollRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [heatmapLoading, heatmapDays]);

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

        {/* Yearly habit heatmap */}
        <View style={styles.yearReviewSection}>
          <Text style={styles.yearReviewTitle}>Your Year in Review</Text>
          <Text style={styles.yearReviewSubtitle}>Last 365 days</Text>

          {heatmapLoading ? (
            <View style={styles.heatmapLoadingBox}>
              <ActivityIndicator size="small" color={COLORS.gold} />
              <Text style={styles.loadingText}>Loading your year...</Text>
            </View>
          ) : heatmapError ? (
            <View style={styles.heatmapErrorBox}>
              <Text style={styles.heatmapErrorText}>{heatmapError}</Text>
            </View>
          ) : (
            <>
              <ScrollView
                ref={heatmapScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.heatmapScroll}
                contentContainerStyle={styles.heatmapScrollContent}
              >
                <View>
                  <View style={[styles.monthLabelRow, styles.ltrHeatmapRow]}>
                    {monthLabelSections.map((section, sectionIndex) => (
                      <View
                        key={`${section.monthLabel}-${sectionIndex}`}
                        style={[
                          styles.monthLabelSection,
                          {
                            width:
                              section.columnCount * HEATMAP_COLUMN_WIDTH,
                          },
                        ]}
                      >
                        <Text style={styles.monthLabel}>
                          {section.monthLabel}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={[styles.heatmapGrid, styles.ltrHeatmapRow]}>
                    {heatmapColumns.map((column) => (
                      <View key={column.columnKey} style={styles.heatmapColumn}>
                        {column.days.map((day) => (
                          <View
                            key={day.date}
                            accessibilityLabel={getHeatmapSquareLabel(day)}
                            style={[
                              styles.heatmapSquare,
                              getHeatmapSquareStyle(day.completionCount),
                            ]}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.heatmapLegend}>
                <Text style={styles.legendText}>Empty → Partial → Full</Text>
                <View style={styles.legendSquares}>
                  <View style={[styles.legendSquare, styles.heatmapEmpty]} />
                  <View style={[styles.legendSquare, styles.heatmapLight]} />
                  <View style={[styles.legendSquare, styles.heatmapMedium]} />
                  <View style={[styles.legendSquare, styles.heatmapFull]} />
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Full History Button ─────────────────────────── */}
        <TouchableOpacity
          className="bg-white/10 rounded-[14px] border border-white/10 py-4 items-center mb-6"
          onPress={() => navigation.navigate("HabitHistory")}
          activeOpacity={0.8}
        >
          <Text className="text-base font-semibold text-white tracking-wider">
            View History 📅
          </Text>
        </TouchableOpacity>

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
  goldSoft: "rgba(212, 160, 23, 0.3)",
  goldMedium: "rgba(212, 160, 23, 0.6)",
  heatmapBorder: "rgba(255,255,255,0.16)",
  heatmapEmptyBorder: "rgba(212, 160, 23, 0.28)",
  errorBg: "rgba(0,0,0,0.22)",
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

  // Year Review Heatmap
  yearReviewSection: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.cardBorder,
    borderRadius: 16,
    borderWidth: 1,
    direction: "ltr",
    marginBottom: 24,
    padding: 16,
  },
  yearReviewTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.gold,
    marginBottom: 4,
  },
  yearReviewSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 14,
  },
  heatmapLoadingBox: {
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.cardBorder,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 22,
  },
  heatmapErrorBox: {
    backgroundColor: COLORS.errorBg,
    borderColor: COLORS.cardBorder,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  heatmapErrorText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  heatmapScroll: {
    direction: "ltr",
    marginBottom: 14,
    minHeight: 112,
  },
  heatmapScrollContent: {
    direction: "ltr",
    paddingRight: 18,
  },
  ltrHeatmapRow: {
    direction: "ltr",
  },
  monthLabelRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  monthLabelSection: {
    height: 16,
  },
  monthLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  heatmapGrid: {
    flexDirection: "row",
  },
  heatmapColumn: {
    marginRight: HEATMAP_SQUARE_GAP,
  },
  heatmapSquare: {
    width: HEATMAP_SQUARE_SIZE,
    height: HEATMAP_SQUARE_SIZE,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.heatmapBorder,
    marginBottom: HEATMAP_SQUARE_GAP,
  },
  heatmapEmpty: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.heatmapEmptyBorder,
  },
  heatmapLight: {
    backgroundColor: COLORS.goldSoft,
  },
  heatmapMedium: {
    backgroundColor: COLORS.goldMedium,
  },
  heatmapFull: {
    backgroundColor: COLORS.gold,
  },
  heatmapLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legendText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  legendSquares: {
    flexDirection: "row",
  },
  legendSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.heatmapBorder,
    marginLeft: 5,
  },

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
