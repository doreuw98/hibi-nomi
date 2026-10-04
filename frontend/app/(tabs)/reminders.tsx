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
import { useI18n } from "@/src/i18n";
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
  { v: 30, key: "reminders.min30" },
  { v: 60, key: "reminders.hour1" },
  { v: 90, key: "reminders.min90" },
  { v: 120, key: "reminders.hours2" },
  { v: 180, key: "reminders.hours3" },
] as const;

const PAUSES = [
  { key: "reminders.min30", minutes: 30 },
  { key: "reminders.hour1", minutes: 60 },
  { key: "reminders.hours2", minutes: 120 },
  { key: "reminders.untilTomorrow", minutes: -1 },
] as const;

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
  const { t } = useI18n();
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
      toast.show(t("reminders.updateError"), "error");
    }
  };

  const enableReminders = async () => {
    let perm = await getPermissionStatus();
    if (!perm.granted) {
      if (perm.canAskAgain) {
        setShowRationale(true);
        return;
      } else {
        toast.show(t("reminders.enableInSettings"), "error");
        // still save the preference; it just won't fire until permission granted
      }
    }
    setPermission(perm);
    await save({ enabled: true, paused_until: null }, t("reminders.on"));
  };

  const confirmRationale = async () => {
    setShowRationale(false);
    const perm = await requestPermission();
    setPermission(perm);
    if (perm.granted) {
      await save({ enabled: true, paused_until: null }, t("reminders.on"));
    } else {
      toast.show(t("reminders.notifOff"), "info");
      await save({ enabled: true }, undefined);
    }
  };

  const toggleEnabled = async (val: boolean) => {
    if (val) {
      await enableReminders();
    } else {
      await cancelAllReminders();
      await save({ enabled: false }, t("reminders.off"));
    }
  };

  const onPickTime = (which: "start" | "end", date?: Date) => {
    setPicker(null);
    if (!date) return;
    const hhmm = dateToHHMM(date);
    if (which === "start") save({ start_time: hhmm }, t("reminders.startUpdated"));
    else save({ end_time: hhmm }, t("reminders.endUpdated"));
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
      toast.show(t("reminders.hhmm"), "error");
      return;
    }
    const which = webTimeOpen;
    setWebTimeOpen(null);
    if (which === "start") save({ start_time: webTimeValue }, t("reminders.startUpdated"));
    else save({ end_time: webTimeValue }, t("reminders.endUpdated"));
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
    await save({ paused_until: until.toISOString() }, t("reminders.pausedToast"));
  };

  const resume = async () => {
    await save({ paused_until: null }, t("reminders.resumed"));
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
        <ScreenHeader title={t("reminders.title")} subtitle={t("reminders.subtitle")} />
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
              <Text style={styles.masterTitle}>{t("reminders.drinking")}</Text>
              <Text style={styles.masterSub}>
                {reminders.enabled ? t("reminders.active") : t("reminders.turnOn")}
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
              <Text style={styles.permText}>{t("reminders.blocked")}</Text>
            </Pressable>
          ) : null}
        </Card>

        {isPaused ? (
          <Card testID="pause-banner">
            <View style={styles.masterRow}>
              <PauseCircle size={24} color={colors.warning} weight="fill" />
              <View style={{ flex: 1 }}>
                <Text style={styles.masterTitle}>{t("reminders.paused")}</Text>
                <Text style={styles.masterSub}>
                  {t("reminders.until", { time: timeTo12h(dateToHHMM(new Date(reminders.paused_until!))) })}
                </Text>
              </View>
              <Button title={t("reminders.resume")} variant="secondary" onPress={resume} testID="resume-button" />
            </View>
          </Card>
        ) : null}

        {/* Interval */}
        <SectionTitle style={{ marginTop: spacing.sm }}>{t("reminders.every")}</SectionTitle>
        <View style={styles.chipsWrap}>
          {INTERVALS.map((it) => {
            const active = reminders.interval_minutes === it.v;
            return (
              <Pressable
                key={it.v}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => save({ interval_minutes: it.v }, t("reminders.intervalUpdated"))}
                testID={`interval-${it.v}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(it.key)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Active window */}
        <SectionTitle style={{ marginTop: spacing.lg }}>{t("reminders.activeWindow")}</SectionTitle>
        <Card>
          <Pressable style={styles.timeRow} onPress={() => openTime("start")} testID="start-time-row">
            <View style={styles.timeLeft}>
              <Clock size={20} color={colors.brandPrimary} weight="fill" />
              <Text style={styles.timeLabel}>{t("reminders.start")}</Text>
            </View>
            <Text style={styles.timeValue}>{timeTo12h(reminders.start_time)}</Text>
          </Pressable>
          <View style={styles.rowDivider} />
          <Pressable style={styles.timeRow} onPress={() => openTime("end")} testID="end-time-row">
            <View style={styles.timeLeft}>
              <Clock size={20} color={colors.info} weight="fill" />
              <Text style={styles.timeLabel}>{t("reminders.end")}</Text>
            </View>
            <Text style={styles.timeValue}>{timeTo12h(reminders.end_time)}</Text>
          </Pressable>
        </Card>

        {/* Pause */}
        <SectionTitle style={{ marginTop: spacing.lg }}>{t("reminders.pause")}</SectionTitle>
        <View style={styles.chipsWrap}>
          {PAUSES.map((p) => (
            <Pressable
              key={p.minutes}
              style={[styles.chip, styles.pauseChip]}
              onPress={() => doPause(p.minutes)}
              testID={`pause-${p.minutes}`}
            >
              <Text style={styles.chipText}>{t(p.key)}</Text>
            </Pressable>
          ))}
        </View>

        {Platform.OS !== "web" ? (
          <Text style={styles.note}>{t("reminders.noteNative")}</Text>
        ) : (
          <Text style={styles.note}>{t("reminders.noteWeb")}</Text>
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

      <Sheet visible={!!showRationale} onClose={() => setShowRationale(false)} title={t("reminders.enableTitle")} testID="rationale-sheet">
        <Text style={styles.rationale}>{t("reminders.rationale")}</Text>
        <Button title={t("reminders.allow")} onPress={confirmRationale} testID="rationale-allow-button" />
      </Sheet>

      <Sheet visible={!!webTimeOpen} onClose={() => setWebTimeOpen(null)} title={t("reminders.setTime")} testID="web-time-sheet">
        <Field testID="web-time-input" value={webTimeValue} onChangeText={setWebTimeValue} placeholder="07:00" />
        <Button title={t("reminders.saveTime")} onPress={saveWebTime} testID="web-time-save" />
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
