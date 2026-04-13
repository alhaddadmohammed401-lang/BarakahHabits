import React from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import RevenueCatUI from "react-native-purchases-ui";

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  navigation: any;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function PaywallScreen({ navigation }: Props) {
  // If the user purchases successfully or restores a previous purchase
  // successfully, RevenueCatUI handles it and gives us a callback.
  const handlePurchaseCompleted = () => {
    navigation.goBack();
  };

  const handleRestoreCompleted = () => {
    navigation.goBack();
  };

  const handleDismiss = () => {
    navigation.goBack();
  };

  // We mount the pre-built RevenueCatUI components.
  // Make sure you have a Paywall configured in the RevenueCat dashboard!
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1B4332" }}>
      <StatusBar style="light" />
      <RevenueCatUI.Paywall
        onPurchaseCompleted={handlePurchaseCompleted}
        onRestoreCompleted={handleRestoreCompleted}
        onDismiss={handleDismiss}
        options={{
          displayCloseButton: true,
        }}
      />
    </SafeAreaView>
  );
}
