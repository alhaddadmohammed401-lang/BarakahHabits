import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
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

type QazaState = {
  Fajr: number;
  Dhuhr: number;
  Asr: number;
  Maghrib: number;
  Isha: number;
};

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

// ── Component ────────────────────────────────────────────────────────────────
export default function QazaScreen({ session }: Props) {
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<QazaState>({
    Fajr: 0,
    Dhuhr: 0,
    Asr: 0,
    Maghrib: 0,
    Isha: 0,
  });

  const totalOwed = Object.values(counts).reduce((a, b) => a + b, 0);

  // ── Data Fetching ────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function loadQaza() {
      if (!userId) return;

      const { data, error } = await supabase
        .from("qaza_prayers")
        .select("prayer_name, count")
        .eq("user_id", userId);

      if (!error && data && active) {
        const newCounts: QazaState = {
          Fajr: 0,
          Dhuhr: 0,
          Asr: 0,
          Maghrib: 0,
          Isha: 0,
        };

        data.forEach((row) => {
          if (PRAYERS.includes(row.prayer_name as any)) {
            newCounts[row.prayer_name as keyof QazaState] = row.count;
          }
        });
        setCounts(newCounts);
      }
      if (active) setLoading(false);
    }

    loadQaza();
    return () => {
      active = false;
    };
  }, [userId]);

  // ── Modifying Counts ─────────────────────────────────────────────────────
  const updatePrayerCount = async (
    prayer: keyof QazaState,
    newCount: number
  ) => {
    if (newCount < 0) return; // Prevent negative counts

    // Optimistic UI Update
    setCounts((prev) => ({ ...prev, [prayer]: newCount }));

    // Supabase Sync
    if (userId) {
      const { error } = await supabase.from("qaza_prayers").upsert(
        {
          user_id: userId,
          prayer_name: prayer,
          count: newCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id, prayer_name" }
      );

      if (error) {
        console.error("Failed to update Qaza count:", error);
      }
    }
  };

  const handleIncrement = (prayer: keyof QazaState) => {
    updatePrayerCount(prayer, counts[prayer] + 1);
  };

  const handleDecrement = (prayer: keyof QazaState) => {
    if (counts[prayer] > 0) {
      updatePrayerCount(prayer, counts[prayer] - 1);
    }
  };

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
          <Text style={styles.headerTitle}>Qaza Prayers</Text>
          <Text style={styles.subtitle}>Track your missed prayers to make them up</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        ) : (
          <>
            {/* ── Total Owed Banner ────────────────────────── */}
            {totalOwed === 0 ? (
              <View style={styles.allCaughtUpBox}>
                <Text style={styles.allCaughtUpIcon}>✨</Text>
                <Text style={styles.allCaughtUpText}>All caught up!</Text>
                <Text style={styles.allCaughtUpSub}>
                  You have no missed prayers to make up.
                </Text>
              </View>
            ) : (
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Total Prayers Owed</Text>
                <Text style={styles.totalNumber}>{totalOwed}</Text>
              </View>
            )}

            {/* ── Prayer List ──────────────────────────────── */}
            <View style={styles.listContainer}>
              {PRAYERS.map((prayer) => {
                const count = counts[prayer];
                return (
                  <View key={prayer} style={styles.prayerCard}>
                    {/* Info */}
                    <View style={styles.prayerInfo}>
                      <Text style={styles.prayerName}>{prayer}</Text>
                      <Text style={styles.prayerCountText}>
                        Owed: <Text style={styles.prayerCountNumber}>{count}</Text>
                      </Text>
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.addButton,
                        ]}
                        onPress={() => handleIncrement(prayer)}
                      >
                        <Text style={styles.addText}>+</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.checkButton,
                          count === 0 && styles.checkButtonDisabled,
                        ]}
                        onPress={() => handleDecrement(prayer)}
                        disabled={count === 0}
                      >
                        <Text style={styles.checkText}>✓</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const COLORS = {
  primary: "#1B4332",
  gold: "#D4A017",
  goldLight: "rgba(212, 160, 23, 0.15)",
  white: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.6)",
  cardBg: "rgba(255,255,255,0.08)",
  cardBorder: "rgba(255,255,255,0.1)",
  success: "#2D6A4F",
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
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.white,
    opacity: 0.8,
  },

  // ── Loading ─────────────────────
  loadingBox: {
    alignItems: "center",
    paddingVertical: 60,
  },

  // ── Top Banners ─────────────────
  totalBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    paddingVertical: 24,
    marginBottom: 28,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  totalNumber: {
    fontSize: 48,
    fontWeight: "800",
    color: COLORS.gold,
  },

  allCaughtUpBox: {
    backgroundColor: COLORS.goldLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212, 160, 23, 0.3)",
    alignItems: "center",
    paddingVertical: 28,
    marginBottom: 28,
  },
  allCaughtUpIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  allCaughtUpText: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.gold,
    marginBottom: 6,
  },
  allCaughtUpSub: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.8,
  },

  // ── Cards ───────────────────────
  listContainer: {
    gap: 12,
  },
  prayerCard: {
    flexDirection: "row",
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "space-between",
  },
  prayerInfo: {
    flex: 1,
  },
  prayerName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.white,
    marginBottom: 4,
  },
  prayerCountText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  prayerCountNumber: {
    color: COLORS.gold,
    fontWeight: "700",
    fontSize: 16,
  },
  
  // ── Actions ─────────────────────
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  addText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "400",
    marginTop: -2,
  },
  checkButton: {
    backgroundColor: COLORS.gold,
  },
  checkButtonDisabled: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    opacity: 0.5,
  },
  checkText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: "800",
  },
});
