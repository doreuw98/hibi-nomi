import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Clock } from "phosphor-react-native";

import { Field } from "@/src/components/ui";
import { timeTo12h } from "@/src/lib/datetime";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

function hhmmToDate(hhmm: string): Date {
  const [h, m] = (hhmm || "07:00").split(":").map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function TimeField({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: string;
  onChange: (hhmm: string) => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [show, setShow] = useState(false);

  if (Platform.OS === "web") {
    return (
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="07:00"
        testID={testID}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.box} onPress={() => setShow(true)} testID={testID}>
        <Clock size={20} color={colors.brandPrimary} weight="fill" />
        <Text style={styles.value}>{timeTo12h(value)}</Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={hhmmToDate(value)}
          mode="time"
          is24Hour={false}
          onChange={(_, date) => {
            setShow(false);
            if (date) onChange(dateToHHMM(date));
          }}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.xs, flex: 1 },
  label: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.onSurface },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  value: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: c.onSurface },
}));
