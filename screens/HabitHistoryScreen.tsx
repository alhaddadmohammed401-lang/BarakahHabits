import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Session } from "@supabase/supabase-js";
import { getMonthlyHabitCompletions } from "../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  session: Session;
  navigation: any;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Returns the number of days in the specified month and year.
 */
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns the day of the week (0-6) of the first day of the specified month.
 */
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

/**
 * Formats a date into a YYYY-MM-DD string key.
 */
function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function HabitHistoryScreen({ session, navigation }: Props) {
  const userId = session?.user?.id;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [completions, setCompletions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  /**
   * Fetches the completion counts from Supabase dynamically when the month changes.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadMonthlyData() {
      if (!userId) return;
      setLoading(true);
      setErrorMsg(null);

      const startDate = formatDateKey(year, month, 1);
      const endDate = formatDateKey(year, month, getDaysInMonth(year, month));

      try {
        const data = await getMonthlyHabitCompletions(
          userId,
          startDate,
          endDate
        );
        if (!cancelled) {
          setCompletions(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err.message || "Failed to load monthly data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMonthlyData();

    return () => {
      cancelled = true;
    };
  }, [userId, year, month]);

  /**
   * Navigates the calendar backwards by one month.
   */
  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  /**
   * Navigates the calendar forwards by one month.
   */
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  // ── Calendar Grid Preparation ──────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const calendarDays = [];

  // Pad the first week with empty slots before the 1st of the month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push({ key: `pad-${i}`, dayNum: null, dateKey: null });
  }

  // Populate the actual days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDateKey(year, month, day);
    calendarDays.push({ key: `day-${day}`, dayNum: day, dateKey });
  }

  /**
   * Determines the NativeWind background color class for a specific completion count.
   */
  function getDayBgcClass(count: number) {
    if (count >= 5) return "bg-gold"; // full completion
    if (count >= 1) return "bg-primaryLight"; // muted green (partial)
    return "bg-primaryDark"; // dark day (empty)
  }

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <StatusBar style="light" />

      {/* ── Header ──────────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-5 mt-5 mb-6">
        <TouchableOpacity
          className="w-11 h-11 rounded-full items-center justify-center border border-white/10 bg-white/5"
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text className="text-xl font-bold text-gold">←</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gold tracking-wide">
          Habit History
        </Text>
        <View className="w-11" />
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10">
        {/* ── Month Navigation ────────────────────────────── */}
        <View className="flex-row justify-between items-center bg-white/5 rounded-2xl p-2 border border-white/10 mb-6">
          <TouchableOpacity
            onPress={prevMonth}
            className="px-4 py-3 rounded-lg bg-white/5"
            activeOpacity={0.7}
          >
            <Text className="text-base text-gold">◀</Text>
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-white tracking-wide">
            {currentDate.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
          <TouchableOpacity
            onPress={nextMonth}
            className="px-4 py-3 rounded-lg bg-white/5"
            activeOpacity={0.7}
          >
            <Text className="text-base text-gold">▶</Text>
          </TouchableOpacity>
        </View>

        {/* ── Loading / Error State ───────────────────────── */}
        <View className="items-center mb-4 min-h-[40px] justify-center">
          {loading ? (
            <ActivityIndicator size="small" color="#D4A017" />
          ) : errorMsg ? (
            <Text className="text-sm text-red-300 italic">{errorMsg}</Text>
          ) : null}
        </View>

        {/* ── Calendar Grid ───────────────────────────────── */}
        <View className="bg-white/5 rounded-[20px] p-4 border border-white/10 mb-6">
          <View className="flex-row mb-3">
            {WEEKDAYS.map((day) => (
              <Text
                key={day}
                className="flex-1 text-center text-white/60 text-xs font-semibold"
              >
                {day}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {calendarDays.map((item) => {
              if (item.dayNum === null) {
                return <View key={item.key} className="w-[14.28%] aspect-square p-1" />;
              }
              const count = item.dateKey ? completions[item.dateKey] || 0 : 0;
              const bgClass = getDayBgcClass(count);
              // text-primary for gold bg to render nicely
              const textClass = count >= 5 ? "text-primary" : "text-white/60";

              return (
                <View key={item.key} className="w-[14.28%] aspect-square p-1 items-center justify-center">
                  <View
                    className={`w-full h-full rounded-lg items-center justify-center ${bgClass}`}
                  >
                    <Text className={`text-sm font-semibold ${textClass}`}>
                      {item.dayNum}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Legend ──────────────────────────────────────── */}
        <View className="bg-white/5 rounded-2xl p-4 border border-white/10 items-center">
          <Text className="text-sm font-semibold text-white/60 mb-3">
            Completion Level
          </Text>
          <View className="flex-row justify-between w-full px-5">
            <View className="items-center">
              <View className="w-6 h-6 rounded-md bg-primaryDark mb-1" />
              <Text className="text-xs text-white/60">Empty</Text>
            </View>
            <View className="items-center">
              <View className="w-6 h-6 rounded-md bg-primaryLight mb-1" />
              <Text className="text-xs text-white/60">Partial</Text>
            </View>
            <View className="items-center">
              <View className="w-6 h-6 rounded-md bg-gold mb-1" />
              <Text className="text-xs text-white/60">Full</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
