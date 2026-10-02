import React, { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Line, Path, Stop } from "react-native-svg";

import { fonts, fontSize, makeStyles, spacing, useTheme } from "@/src/theme";
import { timeOfISO } from "@/src/lib/datetime";

export type ChartRecord = { consumed_at: string | null; amount_ml: number };

type Props = {
  records: ChartRecord[]; // sorted ascending by time
  target: number;
};

function minutesOf(iso: string | null): number {
  if (!iso) return 0;
  const t = timeOfISO(iso);
  if (!t) return 0;
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

export function DailyChart({ records, target }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const height = 170;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 18;

  const innerW = Math.max(width - padL - padR, 1);
  const innerH = height - padT - padB;

  // cumulative
  let cum = 0;
  const points = records.map((r) => {
    cum += r.amount_ml;
    return { x: minutesOf(r.consumed_at), y: cum };
  });
  const maxY = Math.max(target, cum, 1);

  // x domain: span of the day, default 6:00 -> 23:00 but expand to data
  const minX = Math.min(6 * 60, points.length ? points[0].x : 6 * 60);
  const maxX = Math.max(23 * 60, points.length ? points[points.length - 1].x : 23 * 60);
  const spanX = Math.max(maxX - minX, 1);

  const sx = (mins: number) => padL + ((mins - minX) / spanX) * innerW;
  const sy = (val: number) => padT + innerH - (val / maxY) * innerH;

  // build step line starting at the first point baseline
  let d = "";
  if (points.length && width > 0) {
    d = `M ${sx(points[0].x)} ${sy(0)}`;
    let prevX = points[0].x;
    let runY = 0;
    for (const p of points) {
      d += ` L ${sx(p.x)} ${sy(runY)}`; // horizontal to event time at prev level
      d += ` L ${sx(p.x)} ${sy(p.y)}`; // step up
      runY = p.y;
      prevX = p.x;
    }
    d += ` L ${sx(maxX)} ${sy(runY)}`;
  }

  const area = d ? `${d} L ${sx(maxX)} ${sy(0)} L ${sx(minX)} ${sy(0)} Z` : "";
  const targetY = sy(target);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} testID="daily-chart">
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.brandSecondary} stopOpacity={0.35} />
              <Stop offset="1" stopColor={colors.brandSecondary} stopOpacity={0.03} />
            </LinearGradient>
          </Defs>
          {/* target reference */}
          <Line
            x1={padL}
            y1={targetY}
            x2={width - padR}
            y2={targetY}
            stroke={colors.warning}
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
          {area ? <Path d={area} fill="url(#areaGrad)" /> : null}
          {d ? <Path d={d} stroke={colors.brandPrimary} strokeWidth={3} fill="none" strokeLinejoin="round" /> : null}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <View style={styles.axis}>
        <Text style={styles.axisText}>{String(Math.floor(minX / 60)).padStart(2, "0")}:00</Text>
        <Text style={styles.axisText}>Goal {target} ml</Text>
        <Text style={styles.axisText}>{String(Math.floor(maxX / 60)).padStart(2, "0")}:00</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  axisText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.muted },
}));
