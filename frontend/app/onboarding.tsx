import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Drop } from "phosphor-react-native";

import { StackHeader } from "@/src/components/StackHeader";
import { TimeField } from "@/src/components/TimeField";
import { Button, Card, Field, SectionTitle } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { useUpdateProfile } from "@/src/api/hooks";
import { ACTIVITY_LEVELS, calculateTarget } from "@/src/lib/target";
import { useI18n } from "@/src/i18n";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Onboarding() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { t } = useI18n();
  const updateProfile = useUpdateProfile();

  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("light");
  const [wake, setWake] = useState("07:00");
  const [sleep, setSleep] = useState("23:00");

  const weightNum = parseFloat(weight);
  const preview = calculateTarget(isNaN(weightNum) ? undefined : weightNum, activity);

  const finish = async () => {
    try {
      await updateProfile.mutateAsync({
        weight: isNaN(weightNum) ? null : weightNum,
        activity_level: activity,
        wake_time: wake,
        sleep_time: sleep,
        target_mode: "auto",
        onboarded: true,
      } as any);
      toast.show(t("onboarding.allSet"), "success");
      router.replace("/(tabs)");
    } catch {
      toast.show(t("onboarding.saveError"), "error");
    }
  };

  const skip = async () => {
    try {
      await updateProfile.mutateAsync({ onboarded: true } as any);
    } catch {}
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.root}>
      <StackHeader title={t("onboarding.title")} />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing["2xl"] }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Card style={styles.previewCard}>
          <View style={styles.previewIcon}>
            <Drop size={28} color={colors.onBrandPrimary} weight="fill" />
          </View>
          <Text style={styles.previewLabel}>{t("onboarding.recommended")}</Text>
          <Text style={styles.previewValue} testID="onboarding-target-preview">
            {preview} ml
          </Text>
          <Text style={styles.previewHint}>{t("onboarding.basedOn")}</Text>
        </Card>

        <SectionTitle style={{ marginTop: spacing.lg }}>{t("target.yourDetails")}</SectionTitle>
        <Field
          label={t("target.weightKg")}
          testID="onboarding-weight-input"
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder={t("target.weightPlaceholder")}
        />

        <Text style={styles.fieldLabel}>{t("target.activityLevel")}</Text>
        <View style={styles.chips}>
          {ACTIVITY_LEVELS.map((lvl) => {
            const active = activity === lvl;
            return (
              <Pressable
                key={lvl}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActivity(lvl)}
                testID={`activity-${lvl}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`activity.${lvl}` as const)}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle style={{ marginTop: spacing.lg }}>{t("target.dailySchedule")}</SectionTitle>
        <View style={styles.timeRow}>
          <TimeField label={t("profile.wakeUp")} value={wake} onChange={setWake} testID="onboarding-wake-time" />
          <TimeField label={t("profile.sleep")} value={sleep} onChange={setSleep} testID="onboarding-sleep-time" />
        </View>

        <Button title={t("onboarding.start")} onPress={finish} loading={updateProfile.isPending} testID="onboarding-finish-button" style={{ marginTop: spacing.xl }} />
        <Pressable style={styles.skip} onPress={skip} testID="onboarding-skip-button">
          <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  previewCard: { alignItems: "center", gap: spacing.xs, backgroundColor: c.brandTertiary },
  previewIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  previewLabel: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: c.onBrandTertiary },
  previewValue: { fontFamily: fonts.extrabold, fontSize: fontSize["4xl"], color: c.onBrandTertiary },
  previewHint: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.onBrandTertiary, textAlign: "center", opacity: 0.8 },
  fieldLabel: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.onSurface, marginTop: spacing.xs },
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
  timeRow: { flexDirection: "row", gap: spacing.md },
  skip: { alignSelf: "center", marginTop: spacing.md, padding: spacing.sm },
  skipText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.muted },
}));
