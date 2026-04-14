import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  session: Session;
  navigation: any;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function HistoryScreen({ session, navigation }: Props) {
  const userId = session?.user?.id;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [completions, setCompletions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    let cancelled = false;

    async function loadMonthlyData() {
      if (!userId) return;
      setLoading(true);

      const startDate = formatDateKey(year, month, 1);
      const endDate = formatDateKey(year, month, getDaysInMonth(year, month));

      const { data, error } = await supabase
        .from("habit_completions")
        .select("habit_id, completed_date")
        .eq("user_id", userId)
        .gte("completed_date", startDate)
        .lte("completed_date", endDate);

      if (!cancelled && !error && data) {
        const counts: Record<string, Set<number>> = {};
        data.forEach((row: any) => {
          const dateKey = row.completed_date.slice(0, 10);
          if (!counts[dateKey]) {
            counts[dateKey] = new Set();
          }
          counts[dateKey].add(row.habit_id);
        });

        const finalCounts: Record<string, number> = {};
        Object.keys(counts).forEach((key) => {
          finalCounts[key] = counts[key].size;
        });

        setCompletions(finalCounts);
      }
      if (!cancelled) {
        setLoading(false);
      }
    }

    loadMonthlyData();

    return () => {
      cancelled = true;
    };
  }, [userId, year, month]);

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  // ── Calendar Grid Logic ────────────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const calendarDays = [];

  // Padding days (empty slots)
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push({ key: `pad-${i}`, dayNum: null, dateKey: null });
  }

  // Actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDateKey(year, month, day);
    calendarDays.push({ key: `day-${day}`, dayNum: day, dateKey });
  }

  // ── Color styles based on count ──────────────────────────────────────────
  function getDayStyle(count: number) {
    if (count >= 5) return styles.dayFull;
    if (count >= 3) return styles.dayMedium;
    if (count >= 1) return styles.dayLight;
    return styles.dayEmpty;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Habit History</Text>
        <View style={{ width: 44 }} /> {/* Spacer */}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ── Month Navigator ─────────────────────────────── */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {currentDate.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>▶</Text>
          </TouchableOpacity>
        </View>

        {/* ── Loading State ───────────────────────────────── */}
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.gold} />
          </View>
        )}

        {/* ── Calendar Grid ───────────────────────────────── */}
        <View style={styles.calendarCard}>
          <View style={styles.weekdaysRow}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={styles.weekdayText}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {calendarDays.map((item) => {
              if (item.dayNum === null) {
                return <View key={item.key} style={styles.dayBoxEmptySlot} />;
              }
              const count = item.dateKey ? completions[item.dateKey] || 0 : 0;
              return (
                <View
                  key={item.key}
                  style={[styles.dayBox, getDayStyle(count)]}
                >
                  <Text
                    style={[
                      styles.dayNumberText,
                      count >= 3 && styles.dayNumberTextDark,
                    ]}
                  >
                    {item.dayNum}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Legend ──────────────────────────────────────── */}
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Completion Level</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSquare, styles.dayEmpty]} />
              <Text style={styles.legendText}>0</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSquare, styles.dayLight]} />
              <Text style={styles.legendText}>1-2</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSquare, styles.dayMedium]} />
              <Text style={styles.legendText}>3-4</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSquare, styles.dayFull]} />
              <Text style={styles.legendText}>5</Text>
            </View>
          </View>
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
  white: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.6)",
  cardBg: "rgba(255,255,255,0.08)",
  cardBorder: "rgba(255,255,255,0.1)",
  goldSoft: "rgba(212, 160, 23, 0.3)",
  goldMedium: "rgba(212, 160, 23, 0.6)",
  emptyBorder: "rgba(212, 160, 23, 0.28)",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  backButtonText: {
    fontSize: 20,
    color: COLORS.gold,
    fontWeight: "bold",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  navButtonText: {
    fontSize: 16,
    color: COLORS.gold,
  },
  monthText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  loadingBox: {
    position: "absolute",
    top: 150,
    alignSelf: "center",
    zIndex: 10,
  },
  calendarCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    marginBottom: 24,
  },
  weekdaysRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayBoxEmptySlot: {
    width: "14.28%", // 100/7
    aspectRatio: 1,
    padding: 4,
  },
  dayBox: {
    width: "14.28%", // 100/7
    aspectRatio: 1,
    marginVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayEmpty: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.emptyBorder,
  },
  dayLight: {
    backgroundColor: COLORS.goldSoft,
  },
  dayMedium: {
    backgroundColor: COLORS.goldMedium,
  },
  dayFull: {
    backgroundColor: COLORS.gold,
  },
  dayNumberText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  dayNumberTextDark: {
    color: COLORS.primary, // for better contrast on medium/full gold backgrounds
  },
  legendContainer: {
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  legendTitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 20,
  },
  legendItem: {
    alignItems: "center",
  },
  legendSquare: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: 6,
  },
  legendText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
});
