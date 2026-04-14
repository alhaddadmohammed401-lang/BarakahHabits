import React, { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { useNotifications } from "./hooks/useNotifications";

import AuthScreen from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import QazaScreen from "./screens/QazaScreen";
import BadgesScreen from "./screens/BadgesScreen";
import PaywallScreen from "./screens/PaywallScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import HabitHistoryScreen from "./screens/HabitHistoryScreen";

// ── Tab Navigator ────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

const COLORS = {
  primary: "#1B4332",
  primaryDark: "#122B21",
  gold: "#D4A017",
  textMuted: "rgba(255,255,255,0.4)",
  tabBorder: "rgba(255,255,255,0.08)",
};

// ── Main Tabs (shown when logged in) ─────────────────────────────────────────
function MainTabs({ session }: { session: Session }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarIcon: ({ focused }) => (
            <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
              🏠
            </Text>
          ),
        }}
      >
        {(props) => <HomeScreen {...props} session={session} />}
      </Tab.Screen>

      <Tab.Screen
        name="Qaza"
        options={{
          tabBarIcon: ({ focused }) => (
            <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
              🕌
            </Text>
          ),
        }}
      >
        {(props) => <QazaScreen {...props} session={session} />}
      </Tab.Screen>

      <Tab.Screen
        name="Badges"
        options={{
          tabBarIcon: ({ focused }) => (
            <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
              🏆
            </Text>
          ),
        }}
      >
        {(props) => <BadgesScreen {...props} session={session} />}
      </Tab.Screen>

      <Tab.Screen
        name="Profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
              👤
            </Text>
          ),
        }}
      >
        {(props) => <ProfileScreen {...props} session={session} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ── Main Stack (Wraps Tabs + Modals) ─────────────────────────────────────────
const Stack = createNativeStackNavigator();

function MainStack({ session }: { session: Session }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs">
        {() => <MainTabs session={session} />}
      </Stack.Screen>
      <Stack.Screen name="HabitHistory">
        {(props) => <HabitHistoryScreen {...props} session={session} />}
      </Stack.Screen>
      <Stack.Screen 
        name="Paywall" 
        component={PaywallScreen} 
        options={{ presentation: "modal" }}
      />
    </Stack.Navigator>
  );
}

console.log("=== APP.TSX MODULE LOADED ===");

// ── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  console.log("APP LOADED");

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  // Schedule prayer time notifications daily
  useNotifications();

  useEffect(() => {
    // Check onboarding status
    AsyncStorage.getItem("barakah_has_completed_onboarding").then((val) => {
      setShowOnboarding(val !== "true");
    });

    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Don't render anything until we know the auth state and onboarding status
  if (loading || showOnboarding === null) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {showOnboarding ? (
          <OnboardingScreen onComplete={() => setShowOnboarding(false)} />
        ) : session ? (
          <MainStack session={session} />
        ) : (
          <AuthScreen />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.primaryDark,
    borderTopWidth: 1,
    borderTopColor: COLORS.tabBorder,
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  tabIcon: {
    fontSize: 22,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
});
