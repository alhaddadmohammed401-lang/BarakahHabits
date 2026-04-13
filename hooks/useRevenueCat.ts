import { useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, CustomerInfo } from "react-native-purchases";

// ── Config ───────────────────────────────────────────────────────────────────
const REVENUECAT_API_KEY = "test_EVixKAyGOYgQaXOKEIGczooXFQU";
const ENTITLEMENT_ID = "Barakah Habits Pro"; // The name of the entitlement in RevenueCat

export function useRevenueCat() {
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize RevenueCat
  useEffect(() => {
    async function init() {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      if (Platform.OS === "ios" || Platform.OS === "android") {
        Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      }

      const customerInfo = await Purchases.getCustomerInfo();
      checkPremiumStatus(customerInfo);
    }
    init();
  }, []);

  // Update premium status based on customer info
  const checkPremiumStatus = (customerInfo: CustomerInfo) => {
    if (typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined") {
      setIsPremium(true);
    } else {
      setIsPremium(false);
    }
    setLoading(false);
  };

  // Listen for purchase updates
  useEffect(() => {
    const customerInfoUpdated = (customerInfo: CustomerInfo) => {
      checkPremiumStatus(customerInfo);
    };
    Purchases.addCustomerInfoUpdateListener(customerInfoUpdated);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(customerInfoUpdated);
    };
  }, []);



  // Restore purchases
  const restorePurchases = async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      checkPremiumStatus(customerInfo);
      return true;
    } catch (e: any) {
      console.error("Error restoring purchases:", e);
      return false;
    }
  };

  return {
    isPremium,
    loading,
    restorePurchases,
  };
}
