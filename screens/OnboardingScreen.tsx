import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Types & Data ─────────────────────────────────────────────────────────────

interface Slide {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
}

const SLIDES: Slide[] = [
  {
    id: "1",
    emoji: "🕌",
    title: "Build Your Deen Daily",
    subtitle:
      "Track your most important Islamic habits and build consistency through streaks",
  },
  {
    id: "2",
    emoji: "🌙",
    title: "Never Miss a Prayer",
    subtitle:
      "Get notified at every prayer time based on your exact location",
  },
  {
    id: "3",
    emoji: "🔥",
    title: "Build Your Streak",
    subtitle:
      "Stay consistent day after day and watch your spiritual growth compound",
  },
];

interface Props {
  onComplete: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OnboardingScreen({ onComplete }: Props) {
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const slidesRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollToNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      // Completed, save to AsyncStorage and notify parent
      try {
        await AsyncStorage.setItem("barakah_has_completed_onboarding", "true");
      } catch (e) {
        console.error("Error saving onboarding status", e);
      }
      onComplete();
    }
  };

  const renderItem = ({ item }: { item: Slide }) => {
    return (
      <View style={[styles.slideContainer, { width }]}>
        <View style={styles.imageContainer}>
          <Text style={styles.emoji}>{item.emoji}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={{ flex: 3 }}>
        <FlatList
          data={SLIDES}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          ref={slidesRef}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          scrollEventThrottle={32}
        />
      </View>

      <View style={styles.footer}>
        {/* Paginator */}
        <View style={styles.paginatorContainer}>
          {SLIDES.map((_, i) => {
            const isActive = i === currentIndex;
            return (
              <View
                key={i.toString()}
                style={[
                  styles.dot,
                  isActive ? styles.dotActive : styles.dotInactive,
                ]}
              />
            );
          })}
        </View>

        {/* Next / Get Started Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={scrollToNext}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const COLORS = {
  primary: "#1B4332",
  gold: "#D4A017",
  white: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.7)",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  slideContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    flex: 0.5,
    justifyContent: "center",
  },
  emoji: {
    fontSize: 120,
    textShadowColor: "rgba(212, 160, 23, 0.3)",
    textShadowOffset: { width: 0, height: 10 },
    textShadowRadius: 20,
  },
  textContainer: {
    flex: 0.3,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.gold,
    marginBottom: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.white,
    textAlign: "center",
    lineHeight: 24,
    opacity: 0.9,
  },
  footer: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 40,
    paddingBottom: 40,
    alignItems: "center",
  },
  paginatorContainer: {
    flexDirection: "row",
    height: 64,
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: COLORS.gold,
  },
  dotInactive: {
    width: 8,
    backgroundColor: "rgba(212, 160, 23, 0.3)",
  },
  button: {
    backgroundColor: COLORS.gold,
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
