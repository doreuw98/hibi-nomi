import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import {
  Drop,
  Plus,
  PencilSimple,
  Trash,
  ClockClockwise,
} from "phosphor-react-native";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { CircularProgress } from "@/src/components/CircularProgress";
import { Button, Card, EmptyState, Field, SectionTitle } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { PresetsSheet } from "@/src/components/PresetsSheet";
import { DEFAULT_PRESETS, iconFor, type Preset } from "@/src/lib/presets";
import { useToast } from "@/src/context/toast";
import { useI18n } from "@/src/i18n";
import {
  useAddIntake,
  useDay,
  useDeleteIntake,
  useProfile,
  useUpdateIntake,
  type Intake,
} from "@/src/api/hooks";
import { localDateString, prettyDate, timeOfISO } from "@/src/lib/datetime";
import { formatVolume, formatVolumeValue, unitLabel, type Unit } from "@/src/lib/format";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Home() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { t } = useI18n();
  const today = localDateString();

  const { data: profile } = useProfile();
  const { data: day, isLoading, isError, refetch } = useDay(today);
  const addIntake = useAddIntake();
  const deleteIntake = useDeleteIntake();
  const updateIntake = useUpdateIntake();

  const unit: Unit = profile?.preferred_unit || "ml";
  const presets: Preset[] = profile?.quick_presets?.length ? (profile.quick_presets as Preset[]) : DEFAULT_PRESETS;
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const [customOpen, setCustomOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [editing, setEditing] = useState<Intake | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const total = day?.total ?? 0;
  const target = day?.target ?? profile?.daily_target ?? 2000;
  const remaining = day?.remaining ?? Math.max(target - total, 0);
  const progress = day?.progress ?? 0;

  const records = useMemo(() => day?.records ?? [], [day]);

  const quickAdd = async (ml: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await addIntake.mutateAsync({ amount_ml: ml });
      toast.show(t("home.added", { amount: formatVolume(ml, unit) }), "success");
    } catch {
      toast.show(t("home.saveError"), "error");
    }
  };

  const submitCustom = async () => {
    const parsed = parseFloat(customAmount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.show(t("home.enterValidAmount"), "error");
      return;
    }
    const ml = unit === "l" ? Math.round(parsed * 1000) : Math.round(parsed);
    if (ml > 5000) {
      toast.show(t("home.tooMuch"), "error");
      return;
    }
    try {
      await addIntake.mutateAsync({ amount_ml: ml });
      toast.show(t("home.added", { amount: formatVolume(ml, unit) }), "success");
      setCustomAmount("");
      setCustomOpen(false);
    } catch {
      toast.show(t("home.saveError"), "error");
    }
  };

  const openEdit = (rec: Intake) => {
    setEditing(rec);
    setEditAmount(unit === "l" ? String(rec.amount_ml / 1000) : String(rec.amount_ml));
  };

  const saveEdit = async () => {
    if (!editing) return;
    const parsed = parseFloat(editAmount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.show(t("home.enterValidAmount"), "error");
      return;
    }
    const ml = unit === "l" ? Math.round(parsed * 1000) : Math.round(parsed);
    try {
      await updateIntake.mutateAsync({ id: editing.id, amount_ml: ml });
      toast.show(t("home.recordUpdated"), "success");
      setEditing(null);
    } catch {
      toast.show(t("home.updateError"), "error");
    }
  };

  const removeRecord = async () => {
    if (!editing) return;
    try {
      await deleteIntake.mutateAsync(editing.id);
      toast.show(t("home.recordDeleted"), "info");
      setEditing(null);
    } catch {
      toast.show(t("home.deleteError"), "error");
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <ScreenHeader title="Hibi Nomi" subtitle={prettyDate(today)} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomChrome + spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress ring */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.ringCard}>
          <CircularProgress progress={target ? total / target : 0}>
            <Text style={styles.ringValue} testID="home-consumed-value">
              {formatVolumeValue(total, unit)}
            </Text>
            <Text style={styles.ringUnit}>{unitLabel(unit)}</Text>
            <Text style={styles.ringTarget} testID="home-target-value">
              {t("home.of", { target: formatVolume(target, unit) })}
            </Text>
          </CircularProgress>

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.brandPrimary }]} testID="home-progress-value">
                {progress}%
              </Text>
              <Text style={styles.statLabel}>{t("home.progress")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.info }]} testID="home-remaining-value">
                {formatVolume(remaining, unit)}
              </Text>
              <Text style={styles.statLabel}>{t("home.remaining")}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Quick add */}
        <View style={styles.quickHead}>
          <SectionTitle style={{ marginBottom: 0 }}>{t("home.quickAdd")}</SectionTitle>
          <Pressable
            onPress={() => setPresetsOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.editPresets, pressed && styles.pillPressed]}
            testID="edit-presets-button"
          >
            <PencilSimple size={16} color={colors.brandPrimary} weight="bold" />
            <Text style={styles.editPresetsText}>{t("home.edit")}</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          {presets.map((p) => {
            const PillIcon = iconFor(p.icon);
            return (
              <Pressable
                key={p.amount_ml}
                style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
                onPress={() => quickAdd(p.amount_ml)}
                testID={`quick-add-${p.amount_ml}`}
              >
                <PillIcon size={20} color={colors.onBrandTertiary} weight="fill" />
                <Text style={styles.pillText}>+{formatVolume(p.amount_ml, unit)}</Text>
              </Pressable>
            );
          })}
          <Pressable
            style={({ pressed }) => [styles.pillCustom, pressed && styles.pillPressed]}
            onPress={() => setCustomOpen(true)}
            testID="quick-add-custom"
          >
            <Plus size={20} color={colors.brandPrimary} weight="bold" />
            <Text style={styles.pillCustomText}>{t("home.custom")}</Text>
          </Pressable>
        </ScrollView>

        {/* History */}
        <View style={styles.historyHead}>
          <SectionTitle style={{ marginBottom: 0 }}>{t("home.todaysLog")}</SectionTitle>
          {addIntake.isPending ? <ActivityIndicator color={colors.brandPrimary} /> : null}
        </View>

        <Card testID="home-history-card">
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brandPrimary} />
            </View>
          ) : isError ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{t("home.loadError")}</Text>
              <Button title={t("home.retry")} variant="secondary" onPress={() => refetch()} testID="home-retry-button" />
            </View>
          ) : records.length === 0 ? (
            <EmptyState
              icon={<Drop size={44} color={colors.brandSecondary} weight="duotone" />}
              title={t("home.noWaterTitle")}
              subtitle={t("home.noWaterSubtitle")}
              testID="home-empty-state"
            />
          ) : (
            records.map((rec, idx) => (
              <Pressable
                key={rec.id}
                style={[styles.logRow, idx > 0 && styles.logRowBorder]}
                onPress={() => openEdit(rec)}
                testID={`history-row-${idx}`}
              >
                <View style={styles.logIcon}>
                  <Drop size={18} color={colors.brandPrimary} weight="fill" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logAmount}>{formatVolume(rec.amount_ml, unit)}</Text>
                  <Text style={styles.logTime}>{timeOfISO(rec.consumed_at) || "—"}</Text>
                </View>
                <PencilSimple size={18} color={colors.muted} />
              </Pressable>
            ))
          )}
        </Card>
      </ScrollView>

      {/* Presets editor */}
      <PresetsSheet visible={presetsOpen} onClose={() => setPresetsOpen(false)} presets={presets} unit={unit} />

      {/* Custom amount sheet */}
      <Sheet visible={customOpen} onClose={() => setCustomOpen(false)} title={t("home.customSheetTitle")} testID="custom-amount-sheet">
        <Field
          label={t("home.amount", { unit: unitLabel(unit) })}
          testID="custom-amount-input"
          value={customAmount}
          onChangeText={setCustomAmount}
          keyboardType="decimal-pad"
          placeholder={unit === "l" ? t("home.amountPlaceholderL") : t("home.amountPlaceholderMl")}
        />
        <Button title={t("home.addWater")} onPress={submitCustom} loading={addIntake.isPending} testID="custom-amount-submit" />
      </Sheet>

      {/* Edit / delete sheet */}
      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={t("home.editRecord")} testID="edit-record-sheet">
        <Field
          label={t("home.amount", { unit: unitLabel(unit) })}
          testID="edit-amount-input"
          value={editAmount}
          onChangeText={setEditAmount}
          keyboardType="decimal-pad"
        />
        <Button title={t("home.saveChanges")} onPress={saveEdit} loading={updateIntake.isPending} testID="edit-save-button" />
        <Button
          title={t("home.deleteRecord")}
          variant="danger"
          icon={<Trash size={18} color="#fff" weight="bold" />}
          onPress={removeRecord}
          loading={deleteIntake.isPending}
          testID="edit-delete-button"
        />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface },
  scroll: { paddingHorizontal: spacing.lg },
  ringCard: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    alignItems: "center",
    gap: spacing.lg,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  ringValue: { fontFamily: fonts.extrabold, fontSize: 46, color: c.onSurface, lineHeight: 50 },
  ringUnit: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: c.muted, marginTop: -4 },
  ringTarget: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: c.muted, marginTop: spacing.xs },
  statRow: { flexDirection: "row", alignItems: "center", width: "100%", paddingHorizontal: spacing.lg },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, height: 34, backgroundColor: c.border },
  statValue: { fontFamily: fonts.extrabold, fontSize: fontSize.xl },
  statLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.muted },
  pillsRow: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  quickHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  editPresets: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  editPresetsText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.brandPrimary },
  pill: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: c.brandTertiary,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderRadius: radius.pill,
  },
  pillPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  pillText: { fontFamily: fonts.extrabold, fontSize: fontSize.base, color: c.onBrandTertiary },
  pillCustom: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: c.brandPrimary,
  },
  pillCustomText: { fontFamily: fonts.extrabold, fontSize: fontSize.base, color: c.brandPrimary },
  historyHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  center: { paddingVertical: spacing.xl, alignItems: "center", gap: spacing.md },
  errorText: { fontFamily: fonts.medium, color: c.muted, fontSize: fontSize.base },
  logRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  logRowBorder: { borderTopWidth: 1, borderTopColor: c.divider },
  logIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  logAmount: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: c.onSurface },
  logTime: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.muted },
}));
