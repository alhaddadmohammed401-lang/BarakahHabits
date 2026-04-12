import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

// ── Component ────────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // ── Sign In ────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
    }
    // On success, App.tsx auth listener will navigate automatically
  }

  // ── Sign Up ────────────────────────────────────────────────────────────
  async function handleSignUp() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      setSuccessMsg(
        "Account created! Check your email to confirm, then log in."
      );
      setIsLogin(true);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Branding ────────────────────────────────────── */}
          <View style={styles.brandSection}>
            <Text style={styles.brandEmoji}>🕌</Text>
            <Text style={styles.brandTitle}>Barakah Habits</Text>
            <Text style={styles.brandArabic}>بركة العادات</Text>
            <Text style={styles.brandSubtitle}>
              Build blessed daily routines
            </Text>
          </View>

          {/* ── Card ────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isLogin ? "Welcome Back" : "Create Account"}
            </Text>
            <Text style={styles.cardSubtitle}>
              {isLogin
                ? "Sign in to continue your journey"
                : "Start your journey of consistency"}
            </Text>

            {/* ── Error / Success ─────────────────────────── */}
            {error !== "" && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}
            {successMsg !== "" && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✅ {successMsg}</Text>
              </View>
            )}

            {/* ── Email ──────────────────────────────────── */}
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {/* ── Password ───────────────────────────────── */}
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError("");
              }}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />

            {/* ── Primary Button ─────────────────────────── */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={isLogin ? handleLogin : handleSignUp}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#1B4332" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isLogin ? "Log In" : "Sign Up"}
                </Text>
              )}
            </TouchableOpacity>

            {/* ── Toggle Mode ────────────────────────────── */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {isLogin
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsLogin(!isLogin);
                  setError("");
                  setSuccessMsg("");
                }}
                disabled={loading}
              >
                <Text style={styles.toggleLink}>
                  {isLogin ? " Sign Up" : " Log In"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  errorBg: "rgba(220, 53, 69, 0.15)",
  errorBorder: "rgba(220, 53, 69, 0.4)",
  errorText: "#FF6B7A",
  successBg: "rgba(40, 167, 69, 0.15)",
  successBorder: "rgba(40, 167, 69, 0.4)",
  successText: "#5BDB7A",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  // ── Brand ──────────────────────
  brandSection: {
    alignItems: "center",
    marginBottom: 36,
  },
  brandEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  brandArabic: {
    fontSize: 22,
    color: COLORS.gold,
    marginTop: 6,
    opacity: 0.8,
  },
  brandSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 8,
    letterSpacing: 0.3,
  },

  // ── Card ───────────────────────
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.white,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 20,
  },

  // ── Error / Success ────────────
  errorBox: {
    backgroundColor: COLORS.errorBg,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 13,
    lineHeight: 18,
  },
  successBox: {
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: COLORS.successText,
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Inputs ─────────────────────
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 16,
  },

  // ── Buttons ────────────────────
  primaryButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    height: 54,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 0.3,
  },

  // ── Toggle ─────────────────────
  toggleRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  toggleText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  toggleLink: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.gold,
  },
});
