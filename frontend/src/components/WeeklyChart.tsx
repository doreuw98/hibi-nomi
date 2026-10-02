import React from "react";
import { Pressable, Text, View } from "react-native";

import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export type WeekDay = { date: string; total: number; target: number; achieved: boolean };

type Props = {
  days: WeekDay[];
  labels: string[]; // short day labels aligned with days
  unitSuffix?: string;
  onSelect?: (date: string) => void;
};

export function WeeklyChart({ days, labels, onSelect }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const target = days[0]?.target || 2000;
  const maxVal = Math.max(target, ...days.map((d) => d.total), 1);
  const chartHeight = 140;

  return (
    <View style={styles.wrap} testID="weekly-chart">
      {/* target reference line label */}
      <View style={styles.bars}>
        {days.map((d, i) => {
          const h = Math.max((d.total / maxVal) * chartHeight, d.total > 0 ? 6 : 0);
          const targetY = (target / maxVal) * chartHeight;
          return (
            <Pressable
              key={d.date}
              style={styles.col}
              onPress={() => onSelect?.(d.date)}
              testID={`weekly-bar-${i}`}
            >
              <View style={[styles.track, { height: chartHeight }]}>
                {/* target marker */}
                <View style={[styles.targetLine, { bottom: targetY }]} />
                <View
                  style={[
                    styles.bar,
                    {
                      height: h,
                      backgroundColor: d.achieved ? colors.success : colors.brandSecondary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.label}>{labels[i]}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Text style={styles.legendText}>Target met</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.brandSecondary }]} />
          <Text style={styles.legendText}>Below target</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.dashLine} />
          <Text style={styles.legendText}>Goal</Text>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.md },
  bars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  col: { flex: 1, alignItems: "center", gap: spacing.xs },
  track: { width: "70%", justifyContent: "flex-end", position: "relative" },
  bar: { width: "100%", borderRadius: radius.sm },
  targetLine: {
    position: "absolute",
    left: -4,
    right: -4,
    height: 2,
    borderRadius: 1,
    backgroundColor: c.warning,
    opacity: 0.8,
  },
  label: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: c.muted },
  legendRow: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dashLine: { width: 14, height: 2, backgroundColor: c.warning },
  legendText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.muted },
}));
