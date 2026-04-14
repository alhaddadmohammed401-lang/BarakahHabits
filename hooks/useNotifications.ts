import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Config ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = "barakah_last_prayer_fetch";

const DUBAI_LAT = 25.2048;
const DUBAI_LNG = 55.2708;

// Aladhan method 4 = Umm Al-Qura University, Makkah
const ALADHAN_METHOD = 4;

interface PrayerNotification {
  prayer: string;
  time: string; // "HH:mm"
  title: string;
  body: string;
}

const PRAYER_MESSAGES: Omit<PrayerNotification, "time">[] = [
  {
    prayer: "Fajr",
    title: "Fajr Prayer 🌅",
    body: "Fajr time — start your day with Barakah",
  },
  {
    prayer: "Dhuhr",
    title: "Dhuhr Prayer ☀️",
    body: "Dhuhr time — take a moment for salah",
  },
  {
    prayer: "Asr",
    title: "Asr Prayer 🌤️",
    body: "Asr time — don't delay your prayer",
  },
  {
    prayer: "Maghrib",
    title: "Maghrib Prayer 🌇",
    body: "Maghrib time — pause and pray",
  },
  {
    prayer: "Isha",
    title: "Isha Prayer 🌙",
    body: "Isha time — end your day with remembrance",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Parse "HH:mm" into a Date object for today.
 * If the time has already passed, returns null.
 */
function parseTimeToday(timeStr: string): Date | null {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);

  // Only schedule if the time hasn't passed yet
  if (d.getTime() <= Date.now()) return null;
  return d;
}

// ── Core Logic ───────────────────────────────────────────────────────────────

async function requestPermissions(): Promise<boolean> {
  console.log("[Permissions] Requesting notification permissions...");
  console.log("[Permissions] Device.isDevice:", Device.isDevice);
  console.log("[Permissions] Platform.OS:", Platform.OS);

  // Notification permission
  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    console.log("[Permissions] Existing status:", existingStatus);
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log("[Permissions] After request, status:", finalStatus);
    }

    if (finalStatus !== "granted") {
      console.log("[Permissions] ❌ Permission NOT granted");
      return false;
    }
    console.log("[Permissions] ✅ Permission granted");
  } else {
    console.log("[Permissions] ⚠️ Not a physical device — skipping permission check");
  }

  // Android notification channel
  if (Platform.OS === "android") {
    console.log("[Permissions] Creating Android notification channel...");
    await Notifications.setNotificationChannelAsync("prayer-times", {
      name: "Prayer Times",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
    console.log("[Permissions] ✅ Android channel created");
  }

  return true;
}

async function getLocation(): Promise<{ lat: number; lng: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      console.log("[Location] Permission denied, using Dubai defaults");
      return { lat: DUBAI_LAT, lng: DUBAI_LNG };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    console.log(
      "[Location] Got coordinates:",
      location.coords.latitude,
      location.coords.longitude
    );

    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    };
  } catch (e) {
    console.error("[Location] Error getting location:", e);
    return { lat: DUBAI_LAT, lng: DUBAI_LNG };
  }
}

async function fetchPrayerTimes(
  lat: number,
  lng: number
): Promise<PrayerNotification[]> {
  const url = `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=${ALADHAN_METHOD}`;

  console.log("[PrayerTimes] Fetching:", url);

  const response = await fetch(url);
  const json = await response.json();

  if (json.code !== 200 || !json.data?.timings) {
    console.error("[PrayerTimes] Bad API response:", json);
    return [];
  }

  const timings = json.data.timings;
  console.log("[PrayerTimes] Timings received:", timings);

  // Map our 5 prayers to their times
  return PRAYER_MESSAGES.map((msg) => ({
    ...msg,
    // Aladhan returns "HH:mm (TZ)" — strip timezone suffix if present
    time: (timings[msg.prayer] || "").split(" ")[0],
  })).filter((p) => p.time !== "");
}

async function scheduleNotifications(
  prayers: PrayerNotification[]
): Promise<void> {
  // Cancel all previously scheduled notifications
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log("[Notifications] Cleared all previous notifications");

  let scheduled = 0;

  for (const prayer of prayers) {
    const triggerDate = parseTimeToday(prayer.time);

    if (!triggerDate) {
      console.log(
        `[Notifications] ${prayer.prayer} at ${prayer.time} already passed, skipping`
      );
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: prayer.title,
        body: prayer.body,
        sound: "default",
        ...(Platform.OS === "android" && {
          channelId: "prayer-times",
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    console.log(
      `[Notifications] ✅ Scheduled ${prayer.prayer} at ${prayer.time}`
    );
    scheduled++;
  }

  console.log(`[Notifications] ${scheduled} notifications scheduled`);
}

async function setupPrayerNotifications(): Promise<void> {
  // 1) Check if we already fetched today
  const today = getTodayDateStr();
  try {
    const lastFetch = await AsyncStorage.getItem(STORAGE_KEY);
    if (lastFetch === today) {
      console.log("[PrayerTimes] Already fetched today, skipping");
      return;
    }
  } catch {
    // ignore
  }

  // 2) Request notification permissions
  const hasPermission = await requestPermissions();
  if (!hasPermission) return;

  // 3) Get user's location
  const { lat, lng } = await getLocation();

  // 4) Fetch prayer times from Aladhan API
  const prayers = await fetchPrayerTimes(lat, lng);
  if (prayers.length === 0) {
    console.error("[PrayerTimes] No prayer times received");
    return;
  }

  // 5) Schedule notifications
  await scheduleNotifications(prayers);

  // 6) Mark today as fetched
  try {
    await AsyncStorage.setItem(STORAGE_KEY, today);
  } catch {
    // ignore
  }

  console.log("[PrayerTimes] Setup complete for", today);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  console.log("[useNotifications] ─── Hook called ───");

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    setupPrayerNotifications().catch((e) => {
      console.error("[PrayerTimes] Setup failed:", e);
    });
  }, []);
}

// ── Milestone Notifications ──────────────────────────────────────────────────

const MILESTONE_STORAGE_KEY = "barakah_notified_milestones";

interface MilestoneConfig {
  days: number;
  message: string;
}

/**
 * The streak milestones and their corresponding notification messages.
 */
const MILESTONES: MilestoneConfig[] = [
  { days: 3, message: "🌱 3 day streak! You're building Barakah!" },
  { days: 7, message: "🔥 1 week streak! SubhanAllah, keep going!" },
  { days: 14, message: "⚡ 2 weeks strong! Allah loves consistency!" },
  { days: 30, message: "🏆 30 days! MashaAllah — you're unstoppable!" },
  { days: 60, message: "💎 60 day streak! Your deen is your superpower!" },
  { days: 100, message: "👑 100 DAYS! You are an inspiration to the Ummah!" },
];

/**
 * Loads the set of milestone day-counts that have already triggered a notification.
 * Returns a Set of numbers representing previously notified milestones.
 */
async function getNotifiedMilestones(): Promise<Set<number>> {
  try {
    const stored = await AsyncStorage.getItem(MILESTONE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Set(Array.isArray(parsed) ? parsed : []);
    }
  } catch {
    // ignore
  }
  return new Set();
}

/**
 * Persists the updated set of notified milestones to AsyncStorage.
 */
async function saveNotifiedMilestones(milestones: Set<number>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      MILESTONE_STORAGE_KEY,
      JSON.stringify(Array.from(milestones))
    );
  } catch {
    // ignore
  }
}

/**
 * Checks whether the current streak has hit a new milestone.
 * If so, sends a local push notification and records it so it only fires once.
 * Called from HomeScreen after all 5 daily habits are completed.
 */
export async function checkMilestoneNotification(
  currentStreak: number
): Promise<void> {
  const notified = await getNotifiedMilestones();

  for (const milestone of MILESTONES) {
    // Fire notification only when streak exactly reaches or newly crosses a milestone
    if (currentStreak >= milestone.days && !notified.has(milestone.days)) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Barakah Habits 🌟",
            body: milestone.message,
            sound: "default",
            ...(Platform.OS === "android" && {
              channelId: "prayer-times",
            }),
          },
          trigger: null, // Fire immediately
        });

        console.log(
          `[Milestone] ✅ Notified for ${milestone.days}-day streak`
        );

        notified.add(milestone.days);
      } catch (e) {
        console.error(`[Milestone] Failed to send notification:`, e);
      }
    }
  }

  await saveNotifiedMilestones(notified);
}
