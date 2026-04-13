import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Session } from "@supabase/supabase-js";
import { BadgeProgress, getBadgeProgress } from "../lib/supabase";

const COLORS = {
  primary: "#1B4332",
  gold: "#D4A017",
  white: "#FFFFFF",
  lockedBg: "rgba(0,0,0,0.22)",
  lockedBorder: "rgba(255,255,255,0.12)",
  lockedText: "rgba(255,255,255,0.52)",
  unlockedBg: "rgba(212,160,23,0.16)",
  unlockedBorder: "rgba(212,160,23,0.7)",
  textMuted: "rgba(255,255,255,0.68)",
  progressTrack: "rgba(255,255,255,0.12)",
  errorBg: "rgba(0,0,0,0.24)",
};

interface Props {
  session: Session;
}

interface BadgeCardProps {
  badge: BadgeProgress;
}

/**
 * Formats Supabase date keys into a friendly unlock date for the user.
 */
function formatUnlockDate(dateKey: string | null): string {
  if (!dateKey) return "";

  const parsedDate = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return dateKey;

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Converts decimal progress into a whole-number percentage for the progress bar.
 */
function getProgressPercent(progress: number): number {
  return Math.round(Math.max(0, Math.min(1, progress)) * 100);
}

/**
 * Renders one badge card with locked, unlocked, and progress states.
 */
function BadgeCard({ badge }: BadgeCardProps) {
  const progressPercent = getProgressPercent(badge.progress);
  const progressWidth = `${progressPercent}%` as `${number}%`;

  return (
    <View
      style={[
        styles.badgeCard,
        badge.unlocked ? styles.unlockedCard : styles.lockedCard,
      ]}
    >
      <View style={styles.badgeTopRow}>
        <Text style={[styles.badgeEmoji, !badge.unlocked && styles.lockedEmoji]}>
          {badge.unlocked ? badge.emoji : "🔒"}
        </Text>
        {badge.unlocked && <Text style={styles.unlockedLabel}>Unlocked</Text>}
      </View>

      <Text
        style={[
          styles.badgeTitle,
          badge.unlocked ? styles.unlockedTitle : styles.lockedTitle,
        ]}
      >
        {badge.title}
      </Text>

      <Text
        style={[
          styles.badgeCondition,
          !badge.unlocked && styles.lockedCondition,
        ]}
      >
        {badge.condition}
      </Text>

      {badge.unlocked ? (
        <Text style={styles.unlockDate}>
          Unlocked {formatUnlockDate(badge.unlockedDate)}
        </Text>
      ) : (
        <View style={styles.progressArea}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressText}>{badge.progressText}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Shows all achievement badges and loads their progress from Supabase.
 */
export default function BadgesScreen({ session }: Props) {
  const userId = session.user.id;
  const [badges, setBadges] = useState<BadgeProgress[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Loads badge progress and exposes errors so the user can retry.
   */
  async function loadBadges() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const nextBadges = await getBadgeProgress(userId);
      setBadges(nextBadges);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load achievements.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBadges();
  }, [userId]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Achievements</Text>
          <Text style={styles.headerSubtitle}>
            Keep showing up. Small deeds become mountains.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.gold} />
            <Text style={styles.loadingText}>Loading achievements...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Achievements need a refresh</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={loadBadges}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.badgeGrid}>
            {badges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  header: {
    marginTop: 20,
    marginBottom: 22,
  },
  headerTitle: {
    color: COLORS.gold,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 70,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  errorBox: {
    backgroundColor: COLORS.errorBg,
    borderColor: COLORS.lockedBorder,
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  errorTitle: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    alignItems: "center",
    borderColor: COLORS.gold,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
  },
  retryText: {
    color: COLORS.gold,
    fontSize: 15,
    fontWeight: "700",
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  badgeCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    minHeight: 210,
    padding: 14,
    width: "48%",
  },
  lockedCard: {
    backgroundColor: COLORS.lockedBg,
    borderColor: COLORS.lockedBorder,
  },
  unlockedCard: {
    backgroundColor: COLORS.unlockedBg,
    borderColor: COLORS.unlockedBorder,
  },
  badgeTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  badgeEmoji: {
    fontSize: 32,
  },
  lockedEmoji: {
    opacity: 0.65,
  },
  unlockedLabel: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  badgeTitle: {
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
    marginBottom: 8,
  },
  unlockedTitle: {
    color: COLORS.gold,
  },
  lockedTitle: {
    color: COLORS.lockedText,
  },
  badgeCondition: {
    color: COLORS.white,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  lockedCondition: {
    color: COLORS.lockedText,
  },
  unlockDate: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 14,
  },
  progressArea: {
    marginTop: 14,
  },
  progressTrack: {
    backgroundColor: COLORS.progressTrack,
    borderRadius: 6,
    height: 8,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: COLORS.gold,
    borderRadius: 6,
    height: 8,
  },
  progressText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
  },
});
