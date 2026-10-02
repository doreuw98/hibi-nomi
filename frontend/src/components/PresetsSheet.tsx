import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowCounterClockwise, Plus, X } from "phosphor-react-native";

import { Sheet } from "@/src/components/Sheet";
import { Button, Field } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { useUpdateProfile } from "@/src/api/hooks";
import { formatVolume, unitLabel, type Unit } from "@/src/lib/format";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export const DEFAULT_PRESETS = [100, 200, 250, 300, 500];
export const MAX_PRESETS = 6;

type Props = {
  visible: boolean;
  onClose: () => void;
  presets: number[];
  unit: Unit;
};

export function PresetsSheet({ visible, onClose, presets, unit }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const updateProfile = useUpdateProfile();

  const [draft, setDraft] = useState<number[]>(presets);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (visible) {
      setDraft(presets);
      setAmount("");
    }
  }, [visible, presets]);

  const addPreset = () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.show("Enter a valid amount", "error");
      return;
    }
    const ml = unit === "l" ? Math.round(parsed * 1000) : Math.round(parsed);
    if (ml > 5000) {
      toast.show("Max 5000 ml per preset", "error");
      return;
    }
    if (draft.includes(ml)) {
      toast.show("That size is already a preset", "info");
      return;
    }
    if (draft.length >= MAX_PRESETS) {
      toast.show(`You can have up to ${MAX_PRESETS} presets`, "error");
      return;
    }
    setDraft([...draft, ml].sort((a, b) => a - b));
    setAmount("");
  };

  const removePreset = (ml: number) => {
    if (draft.length <= 1) {
      toast.show("Keep at least one preset", "info");
      return;
    }
    setDraft(draft.filter((p) => p !== ml));
  };

  const save = async () => {
    try {
      await updateProfile.mutateAsync({ quick_presets: draft });
      toast.show("Quick-add buttons updated", "success");
      onClose();
    } catch {
      toast.show("Could not save presets", "error");
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Quick-add presets" testID="presets-sheet">
      <Text style={styles.hint}>Match your favourite cup and bottle sizes. Tap × to remove one.</Text>

      <View style={styles.chipsHead}>
        <Text style={styles.chipsLabel}>{draft.length}/{MAX_PRESETS} presets</Text>
        <Pressable
          onPress={() => setDraft(DEFAULT_PRESETS)}
          hitSlop={8}
          style={styles.resetLink}
          testID="presets-reset-button"
        >
          <ArrowCounterClockwise size={16} color={colors.brandPrimary} weight="bold" />
          <Text style={styles.resetText}>Reset to defaults</Text>
        </Pressable>
      </View>

      <View style={styles.chips} testID="presets-chip-list">
        {draft.map((ml) => (
          <View key={ml} style={styles.chip} testID={`preset-chip-${ml}`}>
            <Text style={styles.chipText}>{formatVolume(ml, unit)}</Text>
            <Pressable
              onPress={() => removePreset(ml)}
              hitSlop={8}
              style={styles.chipRemove}
              testID={`preset-remove-${ml}`}
            >
              <X size={14} color={colors.onBrandTertiary} weight="bold" />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.addRow}>
        <View style={{ flex: 1 }}>
          <Field
            label={`New size (${unitLabel(unit)})`}
            testID="preset-amount-input"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={unit === "l" ? "e.g. 0.75" : "e.g. 750"}
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

      <Button title="Save presets" onPress={save} loading={updateProfile.isPending} testID="presets-save-button" />
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
  },
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
