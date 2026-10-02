import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Minus, Plus, Drop } from "phosphor-react-native";

import { StackHeader } from "@/src/components/StackHeader";
import { TimeField } from "@/src/components/TimeField";
import { Button, Card, Field, SectionTitle } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { useProfile, useUpdateProfile } from "@/src/api/hooks";
import { ACTIVITY_OPTIONS, calculateTarget } from "@/src/lib/target";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function TargetScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("light");
  const [wake, setWake] = useState("07:00");
  const [sleep, setSleep] = useState("23:00");
  const [mode, setMode] = useState<"auto" | "custom">("auto");
  const [customTarget, setCustomTarget] = useState(2000);

  useEffect(() => {
    if (!profile) return;
    setWeight(profile.weight ? String(profile.weight) : "");
    setActivity(profile.activity_level || "light");
    setWake(profile.wake_time || "07:00");
    setSleep(profile.sleep_time || "23:00");
    setMode(profile.target_mode || "auto");
    setCustomTarget(profile.daily_target || 2000);
  }, [profile]);

  const weightNum = parseFloat(weight);
  const autoTarget = calculateTarget(isNaN(weightNum) ? undefined : weightNum, activity);
  const effectiveTarget = mode === "auto" ? autoTarget : customTarget;

  const step = (delta: number) => {
    setCustomTarget((t) => Math.min(Math.max(t + delta, 500), 6000));
  };

  const save = async () => {
    try {
      await updateProfile.mutateAsync({
        weight: isNaN(weightNum) ? null : weightNum,
        activity_level: activity,
        wake_time: wake,
        sleep_time: sleep,
        target_mode: mode,
        ...(mode === "custom" ? { daily_target: customTarget } : {}),
      } as any);
      toast.show("Target saved 💧", "success");
      router.back();
    } catch {
      toast.show("Could not save target", "error");
    }
  };

  return (
    <View style={styles.root}>
      <StackHeader title="Personal target" />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing["2xl"] }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Card style={styles.previewCard}>
          <View style={styles.previewIcon}>
            <Drop size={26} color={colors.onBrandPrimary} weight="fill" />
          </View>
          <Text style={styles.previewLabel}>Your daily target</Text>
          <Text style={styles.previewValue} testID="target-effective-value">
            {effectiveTarget} ml
          </Text>
          {mode === "custom" ? (
            <Text style={styles.previewHint}>Auto suggestion: {autoTarget} ml</Text>
          ) : (
            <Text style={styles.previewHint}>Calculated from your weight & activity</Text>
          )}
        </Card>

        {/* mode toggle */}
        <View style={styles.segment}>
          <Pressable
            style={[styles.segmentItem, mode === "auto" && styles.segmentActive]}
            onPress={() => setMode("auto")}
            testID="target-mode-auto"
          >
            <Text style={[styles.segmentText, mode === "auto" && styles.segmentTextActive]}>Automatic</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentItem, mode === "custom" && styles.segmentActive]}
            onPress={() => setMode("custom")}
            testID="target-mode-custom"
          >
            <Text style={[styles.segmentText, mode === "custom" && styles.segmentTextActive]}>Custom</Text>
          </Pressable>
        </View>

        {mode === "custom" ? (
          <Card>
            <Text style={styles.fieldLabel}>Set your custom target</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => step(-50)} testID="target-decrease">
                <Minus size={22} color={colors.brandPrimary} weight="bold" />
              </Pressable>
              <View style={styles.stepValueWrap}>
                <Text style={styles.stepValue} testID="target-custom-value">
                  {customTarget}
                </Text>
                <Text style={styles.stepUnit}>ml</Text>
              </View>
              <Pressable style={styles.stepBtn} onPress={() => step(50)} testID="target-increase">
                <Plus size={22} color={colors.brandPrimary} weight="bold" />
              </Pressable>
            </View>
          </Card>
        ) : null}

        <SectionTitle style={{ marginTop: spacing.lg }}>Your details</SectionTitle>
        <Field
          label="Weight (kg)"
          testID="target-weight-input"
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder="e.g. 65"
        />
        <Text style={styles.fieldLabel}>Activity level</Text>
        <View style={styles.chips}>
          {ACTIVITY_OPTIONS.map((opt) => {
            const active = activity === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActivity(opt.value)}
                testID={`target-activity-${opt.value}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle style={{ marginTop: spacing.lg }}>Daily schedule</SectionTitle>
        <Text style={styles.scheduleHint}>Used to set your active hydration window for reminders.</Text>
        <View style={styles.timeRow}>
          <TimeField label="Wake up" value={wake} onChange={setWake} testID="target-wake-time" />
          <TimeField label="Sleep" value={sleep} onChange={setSleep} testID="target-sleep-time" />
        </View>

        <Button title="Save target" onPress={save} loading={updateProfile.isPending} testID="target-save-button" style={{ marginTop: spacing.xl }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  previewCard: { alignItems: "center", gap: spacing.xs, backgroundColor: c.brandTertiary },
  previewIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  previewLabel: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: c.onBrandTertiary },
  previewValue: { fontFamily: fonts.extrabold, fontSize: fontSize["4xl"], color: c.onBrandTertiary },
  previewHint: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.onBrandTertiary, opacity: 0.8 },
  segment: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.pill },
  segmentActive: { backgroundColor: c.surfaceSecondary, shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.muted },
  segmentTextActive: { color: c.brandPrimary },
  fieldLabel: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.onSurface },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValueWrap: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  stepValue: { fontFamily: fonts.extrabold, fontSize: fontSize["3xl"], color: c.onSurface },
  stepUnit: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: c.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
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
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  chipText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.onSurface },
  chipTextActive: { color: c.onBrandPrimary },
  scheduleHint: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.muted, marginTop: -spacing.xs },
  timeRow: { flexDirection: "row", gap: spacing.md },
}));
