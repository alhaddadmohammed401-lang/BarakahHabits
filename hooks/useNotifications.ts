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
