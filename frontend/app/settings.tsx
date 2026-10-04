import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Sharing from "expo-sharing";
import { DownloadSimple, Drop, Moon, Palette, SlidersHorizontal, Sun, Translate } from "phosphor-react-native";

import { StackHeader } from "@/src/components/StackHeader";
import { Button, Card, Field, SectionTitle } from "@/src/components/ui";
import { PresetsSheet } from "@/src/components/PresetsSheet";
import { DEFAULT_PRESETS, iconFor, type Preset } from "@/src/lib/presets";
import { useToast } from "@/src/context/toast";
import { LANGUAGES, useI18n, type Lang } from "@/src/i18n";
import { useAuth } from "@/src/context/auth";
import { useProfile, useUpdateProfile } from "@/src/api/hooks";
import { api } from "@/src/api/client";
import { formatVolume } from "@/src/lib/format";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme, type ThemePreference } from "@/src/theme";

export default function Settings() {
  const styles = useStyles();
  const { colors, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { t, lang, setLang } = useI18n();
  const { user, refresh } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);

  useEffect(() => {
    setName(user?.name || profile?.name || "");
  }, [user, profile]);

  const unit = profile?.preferred_unit || "ml";
  const presets: Preset[] = profile?.quick_presets?.length ? (profile.quick_presets as Preset[]) : DEFAULT_PRESETS;

  const setUnit = async (u: "ml" | "l") => {
    if (u === unit) return;
    try {
      await updateProfile.mutateAsync({ preferred_unit: u } as any);
      toast.show(u === "l" ? t("settings.unitSetL") : t("settings.unitSetMl"), "success");
    } catch {
      toast.show(t("settings.unitError"), "error");
    }
  };

  const changeTheme = async (p: ThemePreference) => {
    if (p === preference) return;
    await setPreference(p);
    toast.show(t("settings.themeSet"), "success");
  };

  const changeLanguage = async (l: Lang) => {
    if (l === lang) return;
    await setLang(l);
    try {
      await updateProfile.mutateAsync({ language: l } as any);
      toast.show(t("settings.languageSet"), "success");
    } catch {
      toast.show(t("settings.languageError"), "error");
    }
  };

  const saveName = async () => {
    if (!name.trim()) {
      toast.show(t("settings.nameEmpty"), "error");
      return;
    }
    try {
      await updateProfile.mutateAsync({ name: name.trim() } as any);
      await refresh();
      toast.show(t("settings.profileUpdated"), "success");
    } catch {
      toast.show(t("settings.nameError"), "error");
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const csv = await api("/export/csv", { raw: true });
      if (!csv || csv.split("\n").length <= 1) {
        toast.show(t("settings.noData"), "info");
        return;
      }
      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "hibinomi_export.csv";
        a.click();
        URL.revokeObjectURL(url);
        toast.show(t("settings.exported"), "success");
      } else {
        const FileSystem = require("expo-file-system/legacy");
        const uri = FileSystem.cacheDirectory + "hibinomi_export.csv";
        await FileSystem.writeAsStringAsync(uri, csv);
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(uri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" });
        } else {
          toast.show(t("settings.savedStorage"), "success");
        }
      }
    } catch {
      toast.show(t("settings.exportFailed"), "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StackHeader title={t("settings.title")} />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing["2xl"] }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {/* Account */}
        <SectionTitle>{t("settings.account")}</SectionTitle>
        <Card>
          <Field label={t("auth.name")} testID="settings-name-input" value={name} onChangeText={setName} placeholder={t("auth.namePlaceholder")} />
          <Text style={styles.readonly}>{user?.email}</Text>
          <Button title={t("settings.saveName")} variant="secondary" onPress={saveName} loading={updateProfile.isPending} testID="settings-save-name" style={{ marginTop: spacing.sm }} />
        </Card>

        {/* Units */}
        <SectionTitle style={{ marginTop: spacing.lg }}>{t("settings.units")}</SectionTitle>
        <Card>
          <View style={styles.rowHead}>
            <Drop size={20} color={colors.brandPrimary} weight="fill" />
            <Text style={styles.rowTitle}>{t("settings.unit")}</Text>
          </View>
          <View style={styles.segment}>
            <Pressable
              style={[styles.segmentItem, unit === "ml" && styles.segmentActive]}
              onPress={() => setUnit("ml")}
              testID="unit-ml"
            >
              <Text style={[styles.segmentText, unit === "ml" && styles.segmentTextActive]}>{t("settings.ml")}</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentItem, unit === "l" && styles.segmentActive]}
              onPress={() => setUnit("l")}
              testID="unit-l"
            >
              <Text style={[styles.segmentText, unit === "l" && styles.segmentTextActive]}>{t("settings.liters")}</Text>
            </Pressable>
          </View>
          <View style={styles.themeRow}>
            <Palette size={20} color={colors.info} weight="fill" />
            <Text style={styles.rowTitle}>{t("settings.theme")}</Text>
          </View>
          <View style={styles.segment} testID="theme-segment">
            {(
              [
                { p: "system", label: t("settings.themeSystem"), Icon: Palette },
                { p: "light", label: t("settings.themeLight"), Icon: Sun },
                { p: "dark", label: t("settings.themeDark"), Icon: Moon },
              ] as const
            ).map(({ p, label, Icon }) => {
              const on = preference === p;
              return (
                <Pressable
                  key={p}
                  style={[styles.segmentItem, on && styles.segmentActive]}
                  onPress={() => changeTheme(p)}
                  testID={`theme-${p}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Icon size={16} color={on ? colors.brandPrimary : colors.muted} weight={on ? "fill" : "regular"} />
                  <Text style={[styles.segmentText, on && styles.segmentTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Language */}
        <SectionTitle style={{ marginTop: spacing.lg }}>{t("settings.language")}</SectionTitle>
        <Card>
          <View style={styles.rowHead}>
            <Translate size={20} color={colors.brandPrimary} weight="fill" />
            <Text style={styles.rowTitle}>{t("settings.language")}</Text>
          </View>
          <View style={styles.langList} testID="language-list">
            {LANGUAGES.map((l, i) => {
              const on = l === lang;
              return (
                <Pressable
                  key={l}
                  style={[styles.langRow, i > 0 && styles.langRowBorder]}
                  onPress={() => changeLanguage(l)}
                  testID={`language-${l}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.langText, on && styles.langTextOn]}>{t(`lang.${l}` as const)}</Text>
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Quick-add presets */}
        <SectionTitle style={{ marginTop: spacing.lg }}>{t("settings.presetsSection")}</SectionTitle>
        <Card>
          <View style={styles.rowHead}>
            <SlidersHorizontal size={20} color={colors.brandPrimary} weight="fill" />
            <Text style={styles.rowTitle}>{t("settings.yourPresets")}</Text>
          </View>
          <View style={styles.presetRow} testID="settings-presets-preview">
            {presets.map((p) => {
              const ChipIcon = iconFor(p.icon);
              return (
                <View key={p.amount_ml} style={styles.presetChip}>
                  <ChipIcon size={14} color={colors.onBrandTertiary} weight="fill" />
                  <Text style={styles.presetChipText}>+{formatVolume(p.amount_ml, unit)}</Text>
                </View>
              );
            })}
          </View>
          <Button
            title={t("settings.editPresets")}
            variant="secondary"
            onPress={() => setPresetsOpen(true)}
            testID="settings-edit-presets"
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Data */}
        <SectionTitle style={{ marginTop: spacing.lg }}>{t("settings.data")}</SectionTitle>
        <Card>
          <Text style={styles.exportHint}>{t("settings.exportHint")}</Text>
          <Button
            title={exporting ? t("settings.preparing") : t("settings.export")}
            onPress={exportData}
            loading={exporting}
            icon={<DownloadSimple size={20} color={colors.onBrandPrimary} weight="bold" />}
            testID="export-csv-button"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </KeyboardAwareScrollView>
      <PresetsSheet visible={presetsOpen} onClose={() => setPresetsOpen(false)} presets={presets} unit={unit} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  readonly: { fontFamily: fonts.medium, fontSize: fontSize.base, color: c.muted, marginTop: spacing.sm },
  rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  rowTitle: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.onSurface },
  segment: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.pill },
  segmentActive: { backgroundColor: c.surfaceSecondary, shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.muted },
  segmentTextActive: { color: c.brandPrimary },
  themeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.md },
  exportHint: { fontFamily: fonts.medium, fontSize: fontSize.base, color: c.onSurfaceSecondary, lineHeight: 22 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  langList: { marginTop: -spacing.xs },
  langRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 },
  langRowBorder: { borderTopWidth: 1, borderTopColor: c.divider },
  langText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: c.onSurface },
  langTextOn: { fontFamily: fonts.extrabold, color: c.brandPrimary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: c.brandPrimary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: c.brandPrimary },
  presetChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.brandTertiary, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill },
  presetChipText: { fontFamily: fonts.extrabold, fontSize: fontSize.sm, color: c.onBrandTertiary },
}));
