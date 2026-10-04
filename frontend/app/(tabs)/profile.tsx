import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import {
  CaretRight,
  Gear,
  SignOut,
  Target,
  Drop,
  User as UserIcon,
  Scales,
  Lightning,
} from "phosphor-react-native";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { useProfile } from "@/src/api/hooks";
import { useI18n } from "@/src/i18n";
import { formatVolume, type Unit } from "@/src/lib/format";
import { timeTo12h } from "@/src/lib/datetime";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Profile() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const { data: profile, isLoading } = useProfile();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const unit: Unit = profile?.preferred_unit || "ml";

  const onLogout = async () => {
    await logout();
    toast.show(t("profile.signedOut"), "info");
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <ScreenHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomChrome + spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <Card testID="profile-identity-card">
          <View style={styles.identity}>
            <View style={styles.avatar}>
              {user?.picture ? (
                <Image source={{ uri: user.picture }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <UserIcon size={30} color={colors.brandPrimary} weight="fill" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} testID="profile-name">
                {user?.name || t("profile.friend")}
              </Text>
              <Text style={styles.email}>{user?.email}</Text>
            </View>
          </View>
        </Card>

        {/* Target summary */}
        <Pressable onPress={() => router.push("/target")} testID="target-card">
          <Card>
            <View style={styles.targetHead}>
              <View style={styles.targetIcon}>
                <Drop size={22} color={colors.onBrandPrimary} weight="fill" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.targetLabel}>{t("profile.dailyTarget")}</Text>
                {isLoading ? (
                  <ActivityIndicator color={colors.brandPrimary} />
                ) : (
                  <Text style={styles.targetValue} testID="profile-target-value">
                    {formatVolume(profile?.daily_target || 2000, unit)}
                  </Text>
                )}
              </View>
              <View style={styles.modeBadge}>
                <Text style={styles.modeText}>{profile?.target_mode === "custom" ? t("profile.custom") : t("profile.auto")}</Text>
              </View>
              <CaretRight size={20} color={colors.muted} />
            </View>
          </Card>
        </Pressable>

        {/* Quick facts */}
        <View style={styles.factsRow}>
          <Card style={styles.factCard}>
            <Scales size={22} color={colors.brandPrimary} weight="fill" />
            <Text style={styles.factValue}>{profile?.weight ? `${profile.weight} kg` : "—"}</Text>
            <Text style={styles.factLabel}>{t("profile.weight")}</Text>
          </Card>
          <Card style={styles.factCard}>
            <Lightning size={22} color={colors.warning} weight="fill" />
            <Text style={styles.factValue} numberOfLines={1}>
              {profile?.activity_level ? t(`activity.short.${profile.activity_level}` as any) : "—"}
            </Text>
            <Text style={styles.factLabel}>{t("profile.activity")}</Text>
          </Card>
        </View>

        <Card style={{ marginTop: spacing.xs }}>
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>{t("profile.wakeUp")}</Text>
            <Text style={styles.scheduleValue}>{timeTo12h(profile?.wake_time || "07:00")}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>{t("profile.sleep")}</Text>
            <Text style={styles.scheduleValue}>{timeTo12h(profile?.sleep_time || "23:00")}</Text>
          </View>
        </Card>

        {/* Menu */}
        <View style={styles.menu}>
          <Pressable style={styles.menuRow} onPress={() => router.push("/target")} testID="menu-target">
            <Target size={22} color={colors.onSurface} weight="regular" />
            <Text style={styles.menuText}>{t("profile.personalTarget")}</Text>
            <CaretRight size={18} color={colors.muted} />
          </Pressable>
          <View style={styles.rowDivider} />
          <Pressable style={styles.menuRow} onPress={() => router.push("/settings")} testID="menu-settings">
            <Gear size={22} color={colors.onSurface} weight="regular" />
            <Text style={styles.menuText}>{t("profile.settings")}</Text>
            <CaretRight size={18} color={colors.muted} />
          </Pressable>
        </View>

        <Pressable style={styles.logout} onPress={onLogout} testID="logout-button">
          <SignOut size={20} color={colors.error} weight="bold" />
          <Text style={styles.logoutText}>{t("profile.signOut")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: c.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  name: { fontFamily: fonts.extrabold, fontSize: fontSize.xl, color: c.onSurface },
  email: { fontFamily: fonts.medium, fontSize: fontSize.base, color: c.muted },
  targetHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  targetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  targetLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.muted },
  targetValue: { fontFamily: fonts.extrabold, fontSize: fontSize.xl, color: c.onSurface },
  modeBadge: { backgroundColor: c.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  modeText: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: c.onBrandTertiary },
  factsRow: { flexDirection: "row", gap: spacing.md },
  factCard: { flex: 1, alignItems: "center", gap: spacing.xs },
  factValue: { fontFamily: fonts.extrabold, fontSize: fontSize.lg, color: c.onSurface },
  factLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.muted },
  scheduleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs },
  scheduleLabel: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: c.onSurfaceSecondary },
  scheduleValue: { fontFamily: fonts.extrabold, fontSize: fontSize.base, color: c.onSurface },
  rowDivider: { height: 1, backgroundColor: c.divider, marginVertical: spacing.xs },
  menu: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  menuText: { flex: 1, fontFamily: fonts.bold, fontSize: fontSize.base, color: c.onSurface },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  logoutText: { fontFamily: fonts.extrabold, fontSize: fontSize.lg, color: c.error },
}));
