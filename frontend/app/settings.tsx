import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Sharing from "expo-sharing";
import { DownloadSimple, Drop, Palette, SlidersHorizontal } from "phosphor-react-native";

import { StackHeader } from "@/src/components/StackHeader";
import { Button, Card, Field, SectionTitle } from "@/src/components/ui";
import { PresetsSheet } from "@/src/components/PresetsSheet";
import { DEFAULT_PRESETS, iconFor, type Preset } from "@/src/lib/presets";
import { useToast } from "@/src/context/toast";
import { useAuth } from "@/src/context/auth";
import { useProfile, useUpdateProfile } from "@/src/api/hooks";
import { api } from "@/src/api/client";
import { formatVolume } from "@/src/lib/format";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Settings() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
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
      toast.show(`Unit set to ${u === "l" ? "liters" : "milliliters"}`, "success");
    } catch {
      toast.show("Could not change unit", "error");
    }
  };

  const saveName = async () => {
    if (!name.trim()) {
      toast.show("Name cannot be empty", "error");
      return;
    }
    try {
      await updateProfile.mutateAsync({ name: name.trim() } as any);
      await refresh();
      toast.show("Profile updated", "success");
    } catch {
      toast.show("Could not update name", "error");
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const csv = await api("/export/csv", { raw: true });
      if (!csv || csv.split("\n").length <= 1) {
        toast.show("No data to export yet", "info");
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
        toast.show("Export downloaded", "success");
      } else {
        const FileSystem = require("expo-file-system/legacy");
        const uri = FileSystem.cacheDirectory + "hibinomi_export.csv";
        await FileSystem.writeAsStringAsync(uri, csv);
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(uri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" });
        } else {
          toast.show("Saved to app storage", "success");
        }
      }
    } catch {
      toast.show("Export failed. Try again.", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StackHeader title="Settings" />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing["2xl"] }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {/* Account */}
        <SectionTitle>Account</SectionTitle>
        <Card>
          <Field label="Name" testID="settings-name-input" value={name} onChangeText={setName} placeholder="Your name" />
          <Text style={styles.readonly}>{user?.email}</Text>
          <Button title="Save name" variant="secondary" onPress={saveName} loading={updateProfile.isPending} testID="settings-save-name" style={{ marginTop: spacing.sm }} />
        </Card>

        {/* Units */}
        <SectionTitle style={{ marginTop: spacing.lg }}>Units & display</SectionTitle>
        <Card>
          <View style={styles.rowHead}>
            <Drop size={20} color={colors.brandPrimary} weight="fill" />
            <Text style={styles.rowTitle}>Measurement unit</Text>
          </View>
          <View style={styles.segment}>
            <Pressable
              style={[styles.segmentItem, unit === "ml" && styles.segmentActive]}
              onPress={() => setUnit("ml")}
              testID="unit-ml"
            >
              <Text style={[styles.segmentText, unit === "ml" && styles.segmentTextActive]}>Milliliters (ml)</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentItem, unit === "l" && styles.segmentActive]}
              onPress={() => setUnit("l")}
              testID="unit-l"
            >
              <Text style={[styles.segmentText, unit === "l" && styles.segmentTextActive]}>Liters (L)</Text>
            </Pressable>
          </View>
          <View style={styles.themeRow}>
            <Palette size={20} color={colors.info} weight="fill" />
            <Text style={styles.rowTitle}>Theme</Text>
            <Text style={styles.themeValue}>Fresh Light</Text>
          </View>
        </Card>

        {/* Quick-add presets */}
        <SectionTitle style={{ marginTop: spacing.lg }}>Quick-add buttons</SectionTitle>
        <Card>
          <View style={styles.rowHead}>
            <SlidersHorizontal size={20} color={colors.brandPrimary} weight="fill" />
            <Text style={styles.rowTitle}>Your presets</Text>
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
            title="Edit presets"
            variant="secondary"
            onPress={() => setPresetsOpen(true)}
            testID="settings-edit-presets"
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Data */}
        <SectionTitle style={{ marginTop: spacing.lg }}>Your data</SectionTitle>
        <Card>
          <Text style={styles.exportHint}>Export all your hydration records as a CSV file (date, time, amount, target).</Text>
          <Button
            title={exporting ? "Preparing…" : "Export data (CSV)"}
            onPress={exportData}
            loading={exporting}
            icon={<DownloadSimple size={20} color="#fff" weight="bold" />}
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
  segmentItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.pill },
  segmentActive: { backgroundColor: c.surfaceSecondary, shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.muted },
  segmentTextActive: { color: c.brandPrimary },
  themeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  themeValue: { marginLeft: "auto", fontFamily: fonts.bold, fontSize: fontSize.base, color: c.muted },
  exportHint: { fontFamily: fonts.medium, fontSize: fontSize.base, color: c.onSurfaceSecondary, lineHeight: 22 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  presetChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.brandTertiary, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill },
  presetChipText: { fontFamily: fonts.extrabold, fontSize: fontSize.sm, color: c.onBrandTertiary },
}));
