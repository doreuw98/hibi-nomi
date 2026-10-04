import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  CaretLeft,
  CaretRight,
  Check,
  TrendUp,
  TrendDown,
  Minus,
  ChartLineUp,
} from "phosphor-react-native";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { WeeklyChart } from "@/src/components/WeeklyChart";
import { Card, EmptyState, SectionTitle } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useMonthly, useProfile, useWeekly } from "@/src/api/hooks";
import { useI18n } from "@/src/i18n";
import {
  addMonths,
  localDateString,
  monthLabel,
  monthString,
  prettyFullDate,
  shortDayName,
} from "@/src/lib/datetime";
import { formatVolume, type Unit } from "@/src/lib/format";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Reports() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, tArray } = useI18n();
  const today = localDateString();

  const { data: profile } = useProfile();
  const unit: Unit = profile?.preferred_unit || "ml";
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const [month, setMonth] = useState(monthString());
  const { data: weekly, isLoading: weeklyLoading } = useWeekly(today);
  const { data: monthly, isLoading: monthlyLoading } = useMonthly(month);
  const [selectedDay, setSelectedDay] = useState<any | null>(null);

  const statusColor = (status: string) => {
    switch (status) {
      case "achieved":
        return colors.success;
      case "partial":
        return colors.warning;
      case "low":
        return colors.brandSecondary;
      default:
        return colors.surfaceTertiary;
    }
  };

  const calendarCells = useMemo(() => {
    if (!monthly?.days?.length) return [];
    const first = new Date(monthly.days[0].date + "T00:00:00");
    const offset = first.getDay();
    return [...Array(offset).fill(null), ...monthly.days];
  }, [monthly]);

  const trendIcon = (trend?: string) => {
    if (trend === "up") return <TrendUp size={18} color={colors.success} weight="bold" />;
    if (trend === "down") return <TrendDown size={18} color={colors.error} weight="bold" />;
    return <Minus size={18} color={colors.muted} weight="bold" />;
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <ScreenHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomChrome + spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Weekly */}
        <SectionTitle>{t("reports.thisWeek")}</SectionTitle>
        <Card testID="weekly-report-card">
          {weeklyLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brandPrimary} />
            </View>
          ) : !weekly?.has_data ? (
            <EmptyState
              icon={<ChartLineUp size={40} color={colors.brandSecondary} weight="duotone" />}
              title={t("reports.noWeekTitle")}
              subtitle={t("reports.noWeekSubtitle")}
              testID="weekly-empty-state"
            />
          ) : (
            <>
              <WeeklyChart
                days={weekly.days}
                labels={weekly.days.map((d: any) => shortDayName(d.date))}
              />
              <View style={styles.kpiGrid}>
                <View style={styles.kpi}>
                  <Text style={styles.kpiValue} testID="weekly-average">
                    {formatVolume(weekly.average, unit)}
                  </Text>
                  <Text style={styles.kpiLabel}>{t("reports.dailyAverage")}</Text>
                </View>
                <View style={styles.kpi}>
                  <Text style={styles.kpiValue} testID="weekly-achieved">
                    {weekly.achieved_count}/7
                  </Text>
                  <Text style={styles.kpiLabel}>{t("reports.targetMet")}</Text>
                </View>
              </View>
              <View style={styles.insights}>
                <View style={styles.insightRow}>
                  {trendIcon(weekly.trend)}
                  <Text style={styles.insightText}>
                    {weekly.trend === "up"
                      ? t("reports.trendUp")
                      : weekly.trend === "down"
                        ? t("reports.trendDown")
                        : t("reports.trendSteady")}
                  </Text>
                </View>
                {weekly.highest ? (
                  <Text style={styles.insightText}>
                    {t("reports.highest", { amount: formatVolume(weekly.highest.total, unit), day: shortDayName(weekly.highest.date) })}
                  </Text>
                ) : null}
                {weekly.lowest ? (
                  <Text style={styles.insightText}>
                    {t("reports.lowest", { amount: formatVolume(weekly.lowest.total, unit), day: shortDayName(weekly.lowest.date) })}
                  </Text>
                ) : null}
                <Text style={styles.insightText}>
                  {t("reports.reached", { n: weekly.achieved_count })}
                </Text>
              </View>
            </>
          )}
        </Card>

        <Pressable style={styles.linkRow} onPress={() => router.push("/day-graph")} testID="view-daily-graph-link">
          <Text style={styles.linkText}>{t("reports.viewDaily")}</Text>
          <ArrowRight size={18} color={colors.brandPrimary} weight="bold" />
        </Pressable>

        {/* Monthly */}
        <View style={styles.monthHead}>
          <SectionTitle style={{ marginBottom: 0 }}>{t("reports.monthly")}</SectionTitle>
          <View style={styles.monthNav}>
            <Pressable onPress={() => setMonth(addMonths(month, -1))} hitSlop={10} testID="month-prev">
              <CaretLeft size={22} color={colors.onSurface} weight="bold" />
            </Pressable>
            <Text style={styles.monthLabel} testID="month-label">
              {monthLabel(month)}
            </Text>
            <Pressable
              onPress={() => {
                const next = addMonths(month, 1);
                if (next <= monthString()) setMonth(next);
              }}
              hitSlop={10}
              testID="month-next"
            >
              <CaretRight size={22} color={month >= monthString() ? colors.border : colors.onSurface} weight="bold" />
            </Pressable>
          </View>
        </View>

        <Card testID="monthly-report-card">
          {monthlyLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brandPrimary} />
            </View>
          ) : (
            <>
              <View style={styles.kpiGrid}>
                <View style={styles.kpi}>
                  <Text style={styles.kpiValue} testID="monthly-average">
                    {formatVolume(monthly?.monthly_average || 0, unit)}
                  </Text>
                  <Text style={styles.kpiLabel}>{t("reports.avgActive")}</Text>
                </View>
                <View style={styles.kpi}>
                  <Text style={styles.kpiValue} testID="monthly-success-days">
                    {monthly?.success_days || 0}
                  </Text>
                  <Text style={styles.kpiLabel}>{t("reports.daysTargetMet")}</Text>
                </View>
                <View style={styles.kpi}>
                  <Text style={styles.kpiValue}>{formatVolume(monthly?.monthly_total || 0, unit)}</Text>
                  <Text style={styles.kpiLabel}>{t("reports.totalMonth")}</Text>
                </View>
              </View>

              {/* calendar */}
              <View style={styles.weekRow}>
                {tArray("date.daysInitial").map((w, i) => (
                  <Text key={i} style={styles.weekLabel}>
                    {w}
                  </Text>
                ))}
              </View>
              <View style={styles.calendar}>
                {calendarCells.map((cell: any, i: number) =>
                  cell == null ? (
                    <View key={`e-${i}`} style={styles.dayCell} />
                  ) : (
                    <Pressable
                      key={cell.date}
                      style={styles.dayCell}
                      onPress={() => setSelectedDay(cell)}
                      testID={`calendar-day-${cell.date}`}
                    >
                      <View style={[styles.dayDot, { backgroundColor: statusColor(cell.status) }]}>
                        {cell.status === "achieved" ? (
                          <Check size={12} color="#fff" weight="bold" />
                        ) : (
                          <Text
                            style={[
                              styles.dayNum,
                              { color: cell.status === "none" ? colors.muted : "#fff" },
                            ]}
                          >
                            {parseInt(cell.date.slice(8, 10), 10)}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  ),
                )}
              </View>

              {/* legend */}
              <View style={styles.legend}>
                {[
                  { k: "achieved", label: t("reports.legendGoal") },
                  { k: "partial", label: t("reports.legendPartial") },
                  { k: "low", label: t("reports.legendLow") },
                  { k: "none", label: t("reports.legendNone") },
                ].map((l) => (
                  <View key={l.k} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: statusColor(l.k) }]} />
                    <Text style={styles.legendText}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </Card>
      </ScrollView>

      <Sheet
        visible={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? prettyFullDate(selectedDay.date) : ""}
        testID="calendar-day-sheet"
      >
        {selectedDay ? (
          <View style={styles.daySheet}>
            <View style={styles.daySheetRow}>
              <Text style={styles.daySheetLabel}>{t("reports.totalIntake")}</Text>
              <Text style={styles.daySheetValue}>{formatVolume(selectedDay.total, unit)}</Text>
            </View>
            <View style={styles.daySheetRow}>
              <Text style={styles.daySheetLabel}>{t("reports.dailyTarget")}</Text>
              <Text style={styles.daySheetValue}>{formatVolume(selectedDay.target, unit)}</Text>
            </View>
            <View style={styles.daySheetRow}>
              <Text style={styles.daySheetLabel}>{t("reports.achievement")}</Text>
              <Text style={[styles.daySheetValue, { color: statusColor(selectedDay.status) }]}>
                {selectedDay.percentage}%
              </Text>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  center: { paddingVertical: spacing.xl, alignItems: "center" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  kpi: {
    flexGrow: 1,
    flexBasis: "30%",
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  kpiValue: { fontFamily: fonts.extrabold, fontSize: fontSize.xl, color: c.onSurface },
  kpiLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.muted },
  insights: { marginTop: spacing.lg, gap: spacing.xs },
  insightRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  insightText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: c.onSurfaceSecondary },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  linkText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.onBrandTertiary },
  monthHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  monthNav: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  monthLabel: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.onSurface, minWidth: 120, textAlign: "center" },
  weekRow: { flexDirection: "row", marginTop: spacing.lg, marginBottom: spacing.sm },
  weekLabel: { flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: fontSize.sm, color: c.muted },
  calendar: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 3 },
  dayDot: { width: "100%", aspectRatio: 1, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  dayNum: { fontFamily: fonts.bold, fontSize: fontSize.sm },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.muted },
  daySheet: { gap: spacing.md },
  daySheetRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  daySheetLabel: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: c.muted },
  daySheetValue: { fontFamily: fonts.extrabold, fontSize: fontSize.lg, color: c.onSurface },
}));
