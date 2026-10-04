import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowCounterClockwise, Plus, X } from "phosphor-react-native";

import { Sheet } from "@/src/components/Sheet";
import { Button, Field } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { useI18n } from "@/src/i18n";
import { useUpdateProfile } from "@/src/api/hooks";
import { formatVolume, unitLabel, type Unit } from "@/src/lib/format";
import {
  DEFAULT_PRESETS,
  MAX_PRESETS,
  PRESET_ICONS,
  defaultIcon,
  iconFor,
  type Preset,
  type PresetIconKey,
} from "@/src/lib/presets";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  presets: Preset[];
  unit: Unit;
};

export function PresetsSheet({ visible, onClose, presets, unit }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { t } = useI18n();
  const updateProfile = useUpdateProfile();

  const [draft, setDraft] = useState<Preset[]>(presets);
  const [amount, setAmount] = useState("");
  // Which chip the icon picker edits; null = the new preset being typed.
  const [selected, setSelected] = useState<number | null>(null);
  const [newIcon, setNewIcon] = useState<PresetIconKey | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(presets);
      setAmount("");
      setSelected(null);
      setNewIcon(null);
    }
  }, [visible, presets]);

  const parsedMl = (() => {
    const p = parseFloat(amount);
    if (isNaN(p) || p <= 0) return null;
    return unit === "l" ? Math.round(p * 1000) : Math.round(p);
  })();

  const activeIcon: PresetIconKey =
    selected !== null
      ? draft.find((p) => p.amount_ml === selected)?.icon ?? "drop"
      : newIcon ?? defaultIcon(parsedMl ?? 0);

  const pickIcon = (key: PresetIconKey) => {
    if (selected !== null) {
      setDraft(draft.map((p) => (p.amount_ml === selected ? { ...p, icon: key } : p)));
    } else {
      setNewIcon(key);
    }
  };

  const addPreset = () => {
    if (parsedMl === null) {
      toast.show(t("home.enterValidAmount"), "error");
      return;
    }
    if (parsedMl > 5000) {
      toast.show(t("presets.max5000"), "error");
      return;
    }
    if (draft.some((p) => p.amount_ml === parsedMl)) {
      toast.show(t("presets.duplicate"), "info");
      return;
    }
    if (draft.length >= MAX_PRESETS) {
      toast.show(t("presets.maxCount", { max: MAX_PRESETS }), "error");
      return;
    }
    const next: Preset = { amount_ml: parsedMl, icon: newIcon ?? defaultIcon(parsedMl) };
    setDraft([...draft, next].sort((a, b) => a.amount_ml - b.amount_ml));
    setAmount("");
    setNewIcon(null);
  };

  const removePreset = (ml: number) => {
    if (draft.length <= 1) {
      toast.show(t("presets.keepOne"), "info");
      return;
    }
    setDraft(draft.filter((p) => p.amount_ml !== ml));
    if (selected === ml) setSelected(null);
  };

  const save = async () => {
    try {
      await updateProfile.mutateAsync({ quick_presets: draft });
      toast.show(t("presets.saved"), "success");
      onClose();
    } catch {
      toast.show(t("presets.saveError"), "error");
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t("presets.title")} testID="presets-sheet">
      <Text style={styles.hint}>{t("presets.hint")}</Text>

      <View style={styles.chipsHead}>
        <Text style={styles.chipsLabel}>{t("presets.count", { n: draft.length, max: MAX_PRESETS })}</Text>
        <Pressable
          onPress={() => {
            setDraft(DEFAULT_PRESETS);
            setSelected(null);
          }}
          hitSlop={8}
          style={styles.resetLink}
          testID="presets-reset-button"
        >
          <ArrowCounterClockwise size={16} color={colors.brandPrimary} weight="bold" />
          <Text style={styles.resetText}>{t("presets.reset")}</Text>
        </Pressable>
      </View>

      <View style={styles.chips} testID="presets-chip-list">
        {draft.map((p) => {
          const ChipIcon = iconFor(p.icon);
          const isSel = selected === p.amount_ml;
          return (
            <Pressable
              key={p.amount_ml}
              style={[styles.chip, isSel && styles.chipSelected]}
              onPress={() => setSelected(isSel ? null : p.amount_ml)}
              testID={`preset-chip-${p.amount_ml}`}
            >
              <ChipIcon size={16} color={colors.onBrandTertiary} weight="fill" />
              <Text style={styles.chipText}>{formatVolume(p.amount_ml, unit)}</Text>
              <Pressable
                onPress={() => removePreset(p.amount_ml)}
                hitSlop={8}
                style={styles.chipRemove}
                testID={`preset-remove-${p.amount_ml}`}
              >
                <X size={14} color={colors.onBrandTertiary} weight="bold" />
              </Pressable>
            </Pressable>
          );
        })}
      </View>

      <View>
        <Text style={styles.iconLabel}>
          {selected !== null ? t("presets.iconFor", { amount: formatVolume(selected, unit) }) : t("presets.iconForNew")}
        </Text>
        <View style={styles.iconRow} testID="preset-icon-picker">
          {PRESET_ICONS.map(({ key, Icon }) => {
            const on = activeIcon === key;
            return (
              <Pressable
                key={key}
                onPress={() => pickIcon(key)}
                style={[styles.iconBtn, on && styles.iconBtnOn]}
                accessibilityLabel={t(`presets.icon.${key}` as const)}
                testID={`preset-icon-${key}`}
              >
                <Icon size={22} color={on ? colors.onBrandPrimary : colors.brandPrimary} weight={on ? "fill" : "regular"} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.addRow}>
        <View style={{ flex: 1 }}>
          <Field
            label={t("presets.newSize", { unit: unitLabel(unit) })}
            testID="preset-amount-input"
            value={amount}
            onChangeText={setAmount}
            onFocus={() => setSelected(null)}
            keyboardType="decimal-pad"
            placeholder={unit === "l" ? t("presets.placeholderL") : t("presets.placeholderMl")}
            onSubmitEditing={addPreset}
            returnKeyType="done"
          />
        </View>
        <Pressable
          onPress={addPreset}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          testID="preset-add-button"
        >
          <Plus size={22} color={colors.onBrandPrimary} weight="bold" />
        </Pressable>
      </View>

      <Button title={t("presets.save")} onPress={save} loading={updateProfile.isPending} testID="presets-save-button" />
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  hint: { fontFamily: fonts.medium, fontSize: fontSize.base, color: c.onSurfaceSecondary, lineHeight: 22 },
  chipsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chipsLabel: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: c.muted },
  resetLink: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36, paddingHorizontal: spacing.xs },
  resetText: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: c.brandPrimary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: c.brandTertiary,
    paddingLeft: spacing.md,
    paddingRight: 4,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: "transparent",
  },
  chipSelected: { borderColor: c.brandPrimary },
  chipText: { fontFamily: fonts.extrabold, fontSize: fontSize.base, color: c.onBrandTertiary },
  chipRemove: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceSecondary,
    marginLeft: 2,
  },
  iconLabel: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: c.muted, marginBottom: spacing.xs },
  iconRow: { flexDirection: "row", gap: spacing.sm },
  iconBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnOn: { backgroundColor: c.brandPrimary },
  addRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
}));
