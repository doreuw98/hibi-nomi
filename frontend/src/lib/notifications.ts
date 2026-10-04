import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { tArray } from "@/src/i18n";

export type ReminderSettings = {
  enabled: boolean;
  interval_minutes: number;
  start_time: string; // "HH:MM"
  end_time: string;
  paused_until: string | null; // ISO local
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function getPermissionStatus() {
  if (Platform.OS === "web") return { granted: false, canAskAgain: false };
  const res = await Notifications.getPermissionsAsync();
  return { granted: res.granted, canAskAgain: res.canAskAgain };
}

export async function requestPermission() {
  if (Platform.OS === "web") return { granted: false, canAskAgain: false };
  const res = await Notifications.requestPermissionsAsync();
  return { granted: res.granted, canAskAgain: res.canAskAgain };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

function buildSlots(settings: ReminderSettings): { hour: number; minute: number }[] {
  const start = toMinutes(settings.start_time);
  const end = toMinutes(settings.end_time);
  const step = settings.interval_minutes;
  const slots: { hour: number; minute: number }[] = [];
  if (end <= start || step <= 0) return slots;
  for (let t = start; t <= end; t += step) {
    slots.push({ hour: Math.floor(t / 60), minute: t % 60 });
  }
  return slots;
}

export async function cancelAllReminders() {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Cancels everything and re-schedules daily repeating reminders for each slot
 * in the active window. Returns the number scheduled. Honors pause by
 * scheduling nothing while paused_until is in the future.
 */
export async function rescheduleReminders(settings: ReminderSettings): Promise<number> {
  if (Platform.OS === "web") return 0;
  await cancelAllReminders();

  if (!settings.enabled) return 0;

  const paused =
    settings.paused_until && new Date(settings.paused_until).getTime() > Date.now();
  if (paused) return 0;

  const slots = buildSlots(settings);
  const messages = tArray("notif.messages");
  let count = 0;
  for (const slot of slots) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "HIBI NOMI",
        body: messages[count % messages.length],
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: slot.hour,
        minute: slot.minute,
      },
    });
    count++;
  }
  return count;
}
