import { useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, CustomerInfo } from "react-native-purchases";

// ── Config ───────────────────────────────────────────────────────────────────
// TODO: Replace with real RevenueCat public API keys for your app
const REVENUECAT_API_KEY_IOS = "appl_placeholder_key";
const REVENUECAT_API_KEY_ANDROID = "goog_placeholder_key";
const ENTITLEMENT_ID = "Premium"; // The name of the entitlement in RevenueCat

export function useRevenueCat() {
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize RevenueCat
  useEffect(() => {
    async function init() {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      if (Platform.OS === "ios") {
        Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
      } else if (Platform.OS === "android") {
        Purchases.configure({ apiKey: REVENUECAT_API_KEY_ANDROID });
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

  // Make a purchase
  const purchasePremium = async () => {
    try {
      // First, fetch the offerings setup in RevenueCat
      const offerings = await Purchases.getOfferings();
      
      // If we have a current offering with available packages
      if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
        
        // Purchase the first available package (usually the monthly or default one we set up)
        const { customerInfo } = await Purchases.purchasePackage(offerings.current.availablePackages[0]);
        
        checkPremiumStatus(customerInfo);
        return true;
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        console.error("Error purchasing premium:", e);
      }
    }
    return false;
  };

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
    purchasePremium,
    restorePurchases,
  };
}
