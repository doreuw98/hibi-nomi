import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BellRinging, BellSlash, Clock, PauseCircle } from "phosphor-react-native";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Button, Card, Field, SectionTitle } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/context/toast";
import { useReminders, useUpdateReminders } from "@/src/api/hooks";
import {
  getPermissionStatus,
  requestPermission,
  rescheduleReminders,
  cancelAllReminders,
} from "@/src/lib/notifications";
import { timeTo12h } from "@/src/lib/datetime";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const INTERVALS = [
  { v: 30, label: "30 min" },
  { v: 60, label: "1 hour" },
  { v: 90, label: "90 min" },
  { v: 120, label: "2 hours" },
  { v: 180, label: "3 hours" },
];

const PAUSES = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "Until tomorrow", minutes: -1 },
];

function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Reminders() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const { data: reminders, isLoading } = useReminders();
  const update = useUpdateReminders();

  const [permission, setPermission] = useState<{ granted: boolean; canAskAgain: boolean }>({
    granted: true,
    canAskAgain: true,
  });
  const [showRationale, setShowRationale] = useState(false);
  const [picker, setPicker] = useState<null | "start" | "end">(null);
  const [webTimeOpen, setWebTimeOpen] = useState<null | "start" | "end">(null);
  const [webTimeValue, setWebTimeValue] = useState("");

  useEffect(() => {
    getPermissionStatus().then(setPermission);
  }, []);

  const sync = useCallback(async () => {
    if (reminders) await rescheduleReminders(reminders);
  }, [reminders]);

  // Reschedule on focus so pauses resume after their window.
  useFocusEffect(
    useCallback(() => {
      sync();
    }, [sync]),
  );

  const save = async (patch: any, successMsg?: string) => {
    try {
      const updated = await update.mutateAsync(patch);
      await rescheduleReminders(updated);
      if (successMsg) toast.show(successMsg, "success");
    } catch {
      toast.show("Could not update reminders", "error");
    }
  };

  const enableReminders = async () => {
    let perm = await getPermissionStatus();
    if (!perm.granted) {
      if (perm.canAskAgain) {
        setShowRationale(true);
        return;
      } else {
        toast.show("Enable notifications in Settings to get reminders", "error");
        // still save the preference; it just won't fire until permission granted
      }
    }
    setPermission(perm);
    await save({ enabled: true, paused_until: null }, "Reminders on 💧");
  };

  const confirmRationale = async () => {
    setShowRationale(false);
    const perm = await requestPermission();
    setPermission(perm);
    if (perm.granted) {
      await save({ enabled: true, paused_until: null }, "Reminders on 💧");
    } else {
      toast.show("Notifications are off — you can enable them anytime", "info");
      await save({ enabled: true }, undefined);
    }
  };

  const toggleEnabled = async (val: boolean) => {
    if (val) {
      await enableReminders();
    } else {
      await cancelAllReminders();
      await save({ enabled: false }, "Reminders off");
    }
  };

  const onPickTime = (which: "start" | "end", date?: Date) => {
    setPicker(null);
    if (!date) return;
    const hhmm = dateToHHMM(date);
    if (which === "start") save({ start_time: hhmm }, "Start time updated");
    else save({ end_time: hhmm }, "End time updated");
  };

  const openTime = (which: "start" | "end") => {
    if (Platform.OS === "web") {
      setWebTimeValue(which === "start" ? reminders?.start_time || "07:00" : reminders?.end_time || "23:00");
      setWebTimeOpen(which);
    } else {
      setPicker(which);
    }
  };

  const saveWebTime = () => {
    if (!/^\d{2}:\d{2}$/.test(webTimeValue)) {
      toast.show("Use HH:MM format", "error");
      return;
    }
    const which = webTimeOpen;
    setWebTimeOpen(null);
    if (which === "start") save({ start_time: webTimeValue }, "Start time updated");
    else save({ end_time: webTimeValue }, "End time updated");
  };

  const doPause = async (minutes: number) => {
    let until: Date;
    if (minutes === -1) {
      until = new Date();
      until.setDate(until.getDate() + 1);
      const [h, m] = (reminders?.start_time || "07:00").split(":").map((x) => parseInt(x, 10));
      until.setHours(h, m, 0, 0);
    } else {
      until = new Date(Date.now() + minutes * 60 * 1000);
    }
    await save({ paused_until: until.toISOString() }, "Reminders paused");
  };

  const resume = async () => {
    await save({ paused_until: null }, "Reminders resumed 💧");
  };

  const isPaused = reminders?.paused_until && new Date(reminders.paused_until).getTime() > Date.now();

  if (isLoading || !reminders) {
    return (
      <View style={[styles.root, styles.loading]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <ScreenHeader title="Reminders" subtitle="Gentle nudges to stay hydrated" />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomChrome + spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Master toggle */}
        <Card>
          <View style={styles.masterRow}>
            <View style={styles.masterIcon}>
              {reminders.enabled ? (
                <BellRinging size={24} color={colors.brandPrimary} weight="fill" />
              ) : (
                <BellSlash size={24} color={colors.muted} weight="fill" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.masterTitle}>Drinking reminders</Text>
              <Text style={styles.masterSub}>
                {reminders.enabled ? "Active" : "Turn on to get water nudges"}
              </Text>
            </View>
            <Switch
              value={reminders.enabled}
              onValueChange={toggleEnabled}
              trackColor={{ true: colors.brandPrimary, false: colors.border }}
              thumbColor="#fff"
              testID="reminders-master-toggle"
            />
          </View>
          {!permission.granted && reminders.enabled ? (
            <Pressable style={styles.permBanner} onPress={() => Linking.openSettings()} testID="open-settings-button">
              <Text style={styles.permText}>Notifications are blocked. Tap to open Settings.</Text>
            </Pressable>
          ) : null}
        </Card>

        {isPaused ? (
          <Card testID="pause-banner">
            <View style={styles.masterRow}>
              <PauseCircle size={24} color={colors.warning} weight="fill" />
              <View style={{ flex: 1 }}>
                <Text style={styles.masterTitle}>Paused</Text>
                <Text style={styles.masterSub}>
                  Until {new Date(reminders.paused_until!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <Button title="Resume" variant="secondary" onPress={resume} testID="resume-button" />
            </View>
          </Card>
        ) : null}

        {/* Interval */}
        <SectionTitle style={{ marginTop: spacing.sm }}>Remind me every</SectionTitle>
        <View style={styles.chipsWrap}>
          {INTERVALS.map((it) => {
            const active = reminders.interval_minutes === it.v;
            return (
              <Pressable
                key={it.v}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => save({ interval_minutes: it.v }, "Interval updated")}
                testID={`interval-${it.v}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{it.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Active window */}
        <SectionTitle style={{ marginTop: spacing.lg }}>Active window</SectionTitle>
        <Card>
          <Pressable style={styles.timeRow} onPress={() => openTime("start")} testID="start-time-row">
            <View style={styles.timeLeft}>
              <Clock size={20} color={colors.brandPrimary} weight="fill" />
              <Text style={styles.timeLabel}>Start</Text>
            </View>
            <Text style={styles.timeValue}>{timeTo12h(reminders.start_time)}</Text>
          </Pressable>
          <View style={styles.rowDivider} />
          <Pressable style={styles.timeRow} onPress={() => openTime("end")} testID="end-time-row">
            <View style={styles.timeLeft}>
              <Clock size={20} color={colors.info} weight="fill" />
              <Text style={styles.timeLabel}>End</Text>
            </View>
            <Text style={styles.timeValue}>{timeTo12h(reminders.end_time)}</Text>
          </Pressable>
        </Card>

        {/* Pause */}
        <SectionTitle style={{ marginTop: spacing.lg }}>Pause reminders</SectionTitle>
        <View style={styles.chipsWrap}>
          {PAUSES.map((p) => (
            <Pressable
              key={p.label}
              style={[styles.chip, styles.pauseChip]}
              onPress={() => doPause(p.minutes)}
              testID={`pause-${p.minutes}`}
            >
              <Text style={styles.chipText}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        {Platform.OS !== "web" ? (
          <Text style={styles.note}>
            Reminders are scheduled on your device and work even when the app is closed.
          </Text>
        ) : (
          <Text style={styles.note}>Notifications fire on the mobile app, not the web preview.</Text>
        )}
      </ScrollView>

      {picker ? (
        <DateTimePicker
          value={hhmmToDate(picker === "start" ? reminders.start_time : reminders.end_time)}
          mode="time"
          is24Hour={false}
          onChange={(_, date) => onPickTime(picker, date)}
        />
      ) : null}

      <Sheet visible={!!showRationale} onClose={() => setShowRationale(false)} title="Enable notifications" testID="rationale-sheet">
        <Text style={styles.rationale}>
          HIBI NOMI sends friendly reminders to drink water during your active hours. We only use this to nudge you — nothing else.
        </Text>
        <Button title="Allow notifications" onPress={confirmRationale} testID="rationale-allow-button" />
      </Sheet>

      <Sheet visible={!!webTimeOpen} onClose={() => setWebTimeOpen(null)} title="Set time (HH:MM)" testID="web-time-sheet">
        <Field testID="web-time-input" value={webTimeValue} onChangeText={setWebTimeValue} placeholder="07:00" />
        <Button title="Save time" onPress={saveWebTime} testID="web-time-save" />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  masterRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  masterIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  masterTitle: { fontFamily: fonts.extrabold, fontSize: fontSize.lg, color: c.onSurface },
  masterSub: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.muted },
  permBanner: { marginTop: spacing.md, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: spacing.md },
  permText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: c.warning },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseChip: { backgroundColor: c.surfaceTertiary, borderColor: c.surfaceTertiary },
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  chipText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.onSurface },
  chipTextActive: { color: c.onBrandPrimary },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  timeLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  timeLabel: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: c.onSurface },
  timeValue: { fontFamily: fonts.extrabold, fontSize: fontSize.lg, color: c.brandPrimary },
  rowDivider: { height: 1, backgroundColor: c.divider, marginVertical: spacing.xs },
  note: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.muted, marginTop: spacing.md, textAlign: "center" },
  rationale: { fontFamily: fonts.medium, fontSize: fontSize.base, color: c.onSurfaceSecondary, lineHeight: 22 },
}));
