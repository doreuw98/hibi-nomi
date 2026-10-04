import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeft, CaretRight, Drop } from "phosphor-react-native";

import { StackHeader } from "@/src/components/StackHeader";
import { DailyChart } from "@/src/components/DailyChart";
import { Card, EmptyState } from "@/src/components/ui";
import { useDay, useProfile } from "@/src/api/hooks";
import { useI18n } from "@/src/i18n";
import { addDays, localDateString, prettyFullDate, timeOfISO } from "@/src/lib/datetime";
import { formatVolume, type Unit } from "@/src/lib/format";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function DayGraph() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const today = localDateString();

  const [date, setDate] = useState(today);
  const { data: profile } = useProfile();
  const { data: day, isLoading } = useDay(date);
  const unit: Unit = profile?.preferred_unit || "ml";

  const records = day?.records ?? [];
  const isToday = date === today;

  return (
    <View style={styles.root}>
      <StackHeader title={t("day.title")} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* day nav */}
        <View style={styles.nav}>
          <Pressable style={styles.navBtn} onPress={() => setDate(addDays(date, -1))} testID="day-prev">
            <CaretLeft size={22} color={colors.onSurface} weight="bold" />
          </Pressable>
          <Text style={styles.navLabel} testID="day-label">
            {isToday ? t("day.today") : prettyFullDate(date)}
          </Text>
          <Pressable
            style={styles.navBtn}
            onPress={() => {
              const next = addDays(date, 1);
              if (next <= today) setDate(next);
            }}
            testID="day-next"
          >
            <CaretRight size={22} color={isToday ? colors.border : colors.onSurface} weight="bold" />
          </Pressable>
        </View>

        <Card testID="day-graph-card">
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brandPrimary} />
            </View>
          ) : records.length === 0 ? (
            <EmptyState
              icon={<Drop size={44} color={colors.brandSecondary} weight="duotone" />}
              title={isToday ? t("day.noDataToday") : t("day.noDataDay")}
              subtitle={t("day.cumulativeHint")}
              testID="day-graph-empty"
            />
          ) : (
            <>
              <View style={styles.summary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{formatVolume(day!.total, unit)}</Text>
                  <Text style={styles.summaryLabel}>{t("day.consumed")}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{formatVolume(day!.target, unit)}</Text>
                  <Text style={styles.summaryLabel}>{t("day.target")}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.brandPrimary }]}>{day!.progress}%</Text>
                  <Text style={styles.summaryLabel}>{t("day.progress")}</Text>
                </View>
              </View>
              <DailyChart records={records} target={day!.target} />
            </>
          )}
        </Card>

        {records.length > 0 ? (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.logTitle}>{t("day.intakeLog")}</Text>
            {records.map((rec, idx) => (
              <View key={rec.id} style={[styles.logRow, idx > 0 && styles.logBorder]}>
                <Text style={styles.logTime}>{timeOfISO(rec.consumed_at) || "—"}</Text>
                <Text style={styles.logAmount}>{formatVolume(rec.amount_ml, unit)}</Text>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  scroll: { paddingHorizontal: spacing.lg },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: { fontFamily: fonts.extrabold, fontSize: fontSize.lg, color: c.onSurface },
  center: { paddingVertical: spacing.xl, alignItems: "center" },
  summary: { flexDirection: "row", marginBottom: spacing.lg },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryValue: { fontFamily: fonts.extrabold, fontSize: fontSize.lg, color: c.onSurface },
  summaryLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.muted },
  logTitle: { fontFamily: fonts.extrabold, fontSize: fontSize.lg, color: c.onSurface, marginBottom: spacing.sm },
  logRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md },
  logBorder: { borderTopWidth: 1, borderTopColor: c.divider },
  logTime: { fontFamily: fonts.medium, fontSize: fontSize.base, color: c.muted },
  logAmount: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.onSurface },
}));
