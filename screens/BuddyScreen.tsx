import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Session } from "@supabase/supabase-js";
import {
  sendBuddyInvite,
  getBuddyConnection,
  acceptBuddyInvite,
  removeBuddy,
  getBuddyStreak,
  BuddyConnection,
} from "../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  session: Session;
}

// ── Color Constants ──────────────────────────────────────────────────────────
const COLORS = {
  primary: "#1B4332",
  primaryLight: "#2D6A4F",
  gold: "#D4A017",
  goldLight: "rgba(212, 160, 23, 0.15)",
  white: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.6)",
  cardBg: "rgba(255,255,255,0.08)",
  cardBorder: "rgba(255,255,255,0.1)",
  completedBorder: "rgba(212, 160, 23, 0.3)",
  inputBg: "rgba(255,255,255,0.06)",
  inputBorder: "rgba(255,255,255,0.15)",
};

// ── Component ────────────────────────────────────────────────────────────────
export default function BuddyScreen({ session }: Props) {
  const userId = session?.user?.id;
  const userEmail = session?.user?.email ?? "You";

  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [buddyEmail, setBuddyEmail] = useState<string>("");
  const [connection, setConnection] = useState<BuddyConnection | null>(null);
  const [connectedBuddyEmail, setConnectedBuddyEmail] = useState<string | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [myStreak, setMyStreak] = useState<number>(0);
  const [buddyStreak, setBuddyStreak] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /**
   * Loads the current buddy connection and streak data on mount.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadBuddyData() {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Fetch current connection
        const result = await getBuddyConnection(userId);

        if (cancelled) return;

        setConnection(result.connection);
        setConnectedBuddyEmail(result.buddyEmail);
        setIsPending(result.isPending);

        // Fetch streaks if connected
        if (result.connection && result.connection.status === "accepted") {
          const buddyId =
            result.connection.requester_id === userId
              ? result.connection.buddy_id
              : result.connection.requester_id;

          const [myStreakVal, buddyStreakVal] = await Promise.all([
            getBuddyStreak(userId),
            getBuddyStreak(buddyId),
          ]);

          if (!cancelled) {
            setMyStreak(myStreakVal);
            setBuddyStreak(buddyStreakVal);
          }
        }
      } catch (e) {
        console.error("[BuddyScreen] Load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBuddyData();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /**
   * Sends a buddy invitation to the entered email address.
   */
  async function handleSendInvite() {
    if (!userId || !buddyEmail.trim()) return;

    setSending(true);
    setErrorMsg(null);

    const result = await sendBuddyInvite(userId, buddyEmail.trim());

    setSending(false);

    if (result.success) {
      Alert.alert(
        "Invite Sent! 🤝",
        "Your buddy will see the invitation next time they open the app.",
        [{ text: "OK" }]
      );
      setBuddyEmail("");
      // Reload connection state
      const connResult = await getBuddyConnection(userId);
      setConnection(connResult.connection);
      setConnectedBuddyEmail(connResult.buddyEmail);
      setIsPending(connResult.isPending);
    } else {
      setErrorMsg(result.error ?? "Something went wrong.");
    }
  }

  /**
   * Accepts a pending buddy invitation.
   */
  async function handleAcceptInvite() {
    if (!connection) return;

    const success = await acceptBuddyInvite(connection.id);
    if (success) {
      setIsPending(false);
      setConnection({ ...connection, status: "accepted" });

      // Fetch streaks now that connection is accepted
      if (userId) {
        const buddyId =
          connection.requester_id === userId
            ? connection.buddy_id
            : connection.requester_id;

        const [myStreakVal, buddyStreakVal] = await Promise.all([
          getBuddyStreak(userId),
          getBuddyStreak(buddyId),
        ]);
        setMyStreak(myStreakVal);
        setBuddyStreak(buddyStreakVal);
      }

      Alert.alert("Connected! 🎉", "You and your buddy are now linked.");
    }
  }

  /**
   * Removes the current buddy connection after confirmation.
   */
  function handleRemoveBuddy() {
    if (!connection) return;

    Alert.alert(
      "Remove Buddy?",
      "You will no longer see each other's streaks.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const success = await removeBuddy(connection.id);
            if (success) {
              setConnection(null);
              setConnectedBuddyEmail(null);
              setIsPending(false);
              setMyStreak(0);
              setBuddyStreak(0);
            }
          },
        },
      ]
    );
  }

  /**
   * Sends the buddy a nudge push notification (placeholder — requires server-side logic).
   */
  function handleSendNudge() {
    Alert.alert(
      "Nudge Sent! 👋",
      `Your buddy ${connectedBuddyEmail ?? ""} has been nudged to stay consistent!`,
      [{ text: "OK" }]
    );
  }

  // ── Loading State ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Loading buddy data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Determine which view to show ───────────────────────────────────────
  const isConnected = connection && connection.status === "accepted";
  const hasPendingIncoming =
    isPending && connection && connection.buddy_id === userId;
  const hasPendingOutgoing =
    isPending && connection && connection.requester_id === userId;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Accountability Buddy</Text>
          <Text style={styles.headerSubtitle}>Stay consistent together</Text>
        </View>

        {/* ── Connected View ──────────────────────────── */}
        {isConnected && (
          <>
            {/* Your streak card */}
            <View style={styles.streakCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {userEmail.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.streakInfo}>
                <Text style={styles.streakLabel}>Your Streak</Text>
                <Text style={styles.streakCount}>🔥 {myStreak} days</Text>
              </View>
            </View>

            {/* Buddy's streak card */}
            <View style={styles.streakCard}>
              <View style={[styles.avatarCircle, styles.buddyAvatar]}>
                <Text style={styles.avatarText}>
                  {connectedBuddyEmail
                    ? connectedBuddyEmail.charAt(0).toUpperCase()
                    : "?"}
                </Text>
              </View>
              <View style={styles.streakInfo}>
                <Text style={styles.streakLabel}>
                  {connectedBuddyEmail ?? "Buddy"}'s Streak
                </Text>
                <Text style={styles.streakCount}>🔥 {buddyStreak} days</Text>
              </View>
            </View>

            {/* Send Nudge button */}
            <TouchableOpacity
              style={styles.nudgeButton}
              onPress={handleSendNudge}
              activeOpacity={0.8}
            >
              <Text style={styles.nudgeButtonText}>Send Nudge 👋</Text>
            </TouchableOpacity>

            {/* Remove buddy link */}
            <TouchableOpacity
              style={styles.removeLink}
              onPress={handleRemoveBuddy}
              activeOpacity={0.5}
            >
              <Text style={styles.removeLinkText}>Remove buddy</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Pending Incoming Invite ─────────────────── */}
        {hasPendingIncoming && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingEmoji}>🤝</Text>
            <Text style={styles.pendingTitle}>Buddy Invite!</Text>
            <Text style={styles.pendingText}>
              {connectedBuddyEmail ?? "Someone"} wants to be your
              accountability buddy.
            </Text>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAcceptInvite}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptButtonText}>Accept Invite</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeLink}
              onPress={handleRemoveBuddy}
              activeOpacity={0.5}
            >
              <Text style={styles.removeLinkText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Pending Outgoing Invite ─────────────────── */}
        {hasPendingOutgoing && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingEmoji}>⏳</Text>
            <Text style={styles.pendingTitle}>Invite Pending</Text>
            <Text style={styles.pendingText}>
              Waiting for {connectedBuddyEmail ?? "your buddy"} to accept your
              invitation.
            </Text>
            <TouchableOpacity
              style={styles.removeLink}
              onPress={handleRemoveBuddy}
              activeOpacity={0.5}
            >
              <Text style={styles.removeLinkText}>Cancel invite</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── No Buddy — Invite Form ─────────────────── */}
        {!connection && (
          <>
            <View style={styles.inviteCard}>
              <Text style={styles.inviteEmoji}>👥</Text>
              <Text style={styles.inviteTitle}>Find Your Buddy</Text>
              <Text style={styles.inviteDescription}>
                Your buddy can see your streak. You can see theirs. Stay
                accountable together on this journey.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter buddy's email"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={buddyEmail}
                onChangeText={setBuddyEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {errorMsg && (
                <Text style={styles.errorText}>{errorMsg}</Text>
              )}

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!buddyEmail.trim() || sending) && styles.sendButtonDisabled,
                ]}
                onPress={handleSendInvite}
                activeOpacity={0.8}
                disabled={!buddyEmail.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.sendButtonText}>Send Invite</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Info card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                💡 Both users need a Barakah Habits account. You can only have
                one buddy at a time.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
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
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 6,
    letterSpacing: 0.3,
  },

  // ── Streak Cards ────────────────
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 18,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.gold,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  buddyAvatar: {
    backgroundColor: COLORS.primaryLight,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.primary,
  },
  streakInfo: {
    flex: 1,
  },
  streakLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "600",
    marginBottom: 4,
  },
  streakCount: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.gold,
  },

  // ── Nudge Button ────────────────
  nudgeButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  nudgeButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 0.3,
  },

  // ── Remove Link ─────────────────
  removeLink: {
    alignItems: "center",
    paddingVertical: 16,
  },
  removeLinkText: {
    fontSize: 13,
    color: COLORS.textMuted,
    opacity: 0.6,
  },

  // ── Pending Card ────────────────
  pendingCard: {
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  pendingEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  pendingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.gold,
    marginBottom: 8,
  },
  pendingText: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  acceptButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
  },

  // ── Invite Card ─────────────────
  inviteCard: {
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 32,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  inviteEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  inviteTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.gold,
    marginBottom: 8,
  },
  inviteDescription: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  input: {
    width: "100%",
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: "#E57373",
    marginBottom: 12,
    textAlign: "center",
  },
  sendButton: {
    width: "100%",
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 0.3,
  },

  // ── Info Card ───────────────────
  infoCard: {
    backgroundColor: COLORS.goldLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.completedBorder,
    padding: 16,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 20,
    textAlign: "center",
  },
});
