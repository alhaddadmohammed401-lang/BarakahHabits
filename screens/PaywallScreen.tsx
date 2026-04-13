import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRevenueCat } from "../hooks/useRevenueCat";

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  navigation: any; // Using any for navigation to avoid deep type dependency here
}

// ── Component ────────────────────────────────────────────────────────────────
export default function PaywallScreen({ navigation }: Props) {
  const { purchasePremium, restorePurchases } = useRevenueCat();
  const [processing, setProcessing] = useState(false);

  const handlePurchase = async () => {
    setProcessing(true);
    const success = await purchasePremium();
    setProcessing(false);
    
    if (success) {
      Alert.alert("Jazakallah Khair!", "You are now a premium member.", [
        { text: "Continue", onPress: () => navigation.goBack() }
      ]);
    }
  };

  const handleRestore = async () => {
    setProcessing(true);
    const success = await restorePurchases();
    setProcessing(false);

    if (success) {
      Alert.alert("Restored", "Your purchases have been restored.", [
        { text: "Continue", onPress: () => navigation.goBack() }
      ]);
    } else {
      Alert.alert("Info", "No previous purchases found.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* ── Close Button ──────────────────────────────────── */}
      <TouchableOpacity 
        style={styles.closeButton} 
        onPress={() => navigation.goBack()}
        disabled={processing}
      >
        <Text style={styles.closeText}>×</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {/* ── Header ───────────────────────────────────────── */}
        <View style={styles.headerContainer}>
          <Text style={styles.heroEmoji}>🌙</Text>
          <Text style={styles.title}>Go Premium</Text>
          <Text style={styles.subtitle}>Unlock the full potential of your habits</Text>
        </View>

        {/* ── Benefits List ────────────────────────────────── */}
        <View style={styles.benefitsContainer}>
          <View style={styles.benefitRow}>
            <Text style={styles.benefitIcon}>✨</Text>
            <Text style={styles.benefitText}>Custom habits (add your own)</Text>
          </View>
          <View style={styles.benefitRow}>
            <Text style={styles.benefitIcon}>📊</Text>
            <Text style={styles.benefitText}>Detailed streak history</Text>
          </View>
          <View style={styles.benefitRow}>
            <Text style={styles.benefitIcon}>🔔</Text>
            <Text style={styles.benefitText}>Custom notification times</Text>
          </View>
          <View style={styles.benefitRow}>
            <Text style={styles.benefitIcon}>🌙</Text>
            <Text style={styles.benefitText}>Ramadan special mode</Text>
          </View>
          <View style={styles.benefitRow}>
            <Text style={styles.benefitIcon}>❤️</Text>
            <Text style={styles.benefitText}>Support an indie Muslim developer</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {/* ── Purchase Button ────────────────────────────── */}
          <TouchableOpacity
            style={[styles.purchaseButton, processing && styles.buttonDisabled]}
            onPress={handlePurchase}
            activeOpacity={0.8}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#1B4332" />
            ) : (
              <Text style={styles.purchaseText}>Start 7-Day Free Trial — $3.99/month</Text>
            )}
          </TouchableOpacity>

          {/* ── Restore & Dismiss ──────────────────────────── */}
          <TouchableOpacity 
            style={styles.restoreButton} 
            onPress={handleRestore}
            disabled={processing}
          >
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dismissButton} 
            onPress={() => navigation.goBack()}
            disabled={processing}
          >
            <Text style={styles.dismissText}>No thanks</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const COLORS = {
  primary: "#1B4332",
  gold: "#D4A017",
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
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "300",
    marginTop: -2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  heroEmoji: {
    fontSize: 72,
    marginBottom: 20,
    textShadowColor: "rgba(212, 160, 23, 0.4)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 15,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: COLORS.gold,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  benefitsContainer: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: 30,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  benefitIcon: {
    fontSize: 22,
    marginRight: 16,
  },
  benefitText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: "500",
    flex: 1,
  },
  footer: {
    marginTop: 40,
    paddingBottom: 20,
  },
  purchaseButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  purchaseText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  restoreButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  restoreText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
  dismissButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  dismissText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
});
