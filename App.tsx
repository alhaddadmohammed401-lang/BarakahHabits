import React, { useState, useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

import AuthScreen from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import ProfileScreen from "./screens/ProfileScreen";

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
        {() => <HomeScreen session={session} />}
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
        {() => <ProfileScreen session={session} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
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

  // Don't render anything until we know the auth state
  if (loading) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {session ? <MainTabs session={session} /> : <AuthScreen />}
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
