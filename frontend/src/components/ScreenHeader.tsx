import React from "react";
import { Pressable, Text, View } from "react-native";

import { fonts, fontSize, makeStyles, spacing } from "@/src/theme";

export function ScreenHeader({
  title,
  subtitle,
  right,
  testID,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  textCol: { flex: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: fontSize["2xl"], color: c.onSurface },
  subtitle: { fontFamily: fonts.medium, fontSize: fontSize.base, color: c.muted, marginTop: 2 },
}));
