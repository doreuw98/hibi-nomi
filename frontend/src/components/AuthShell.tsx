import React from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Drop } from "phosphor-react-native";

import { useI18n } from "@/src/i18n";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.brandSecondary, colors.brandPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing["2xl"] }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <View style={styles.brand}>
          <View style={styles.logoCircle}>
            <Drop size={34} color={colors.brandPrimary} weight="fill" />
          </View>
          <Text style={styles.brandName}>HIBI NOMI</Text>
          <Text style={styles.brandTag}>{t("auth.brandTag")}</Text>
        </View>

        <View style={[styles.card, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.form}>{children}</View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.brandPrimary },
  gradient: { ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const) },
  scroll: { flexGrow: 1, justifyContent: "flex-end" },
  brand: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing["2xl"] },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontFamily: fonts.extrabold, fontSize: fontSize["3xl"], color: "#FFFFFF", letterSpacing: 1 },
  brandTag: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: "rgba(255,255,255,0.9)" },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  title: { fontFamily: fonts.extrabold, fontSize: fontSize["2xl"], color: c.onSurface },
  subtitle: { fontFamily: fonts.medium, fontSize: fontSize.base, color: c.muted, marginBottom: spacing.md },
  form: { gap: spacing.md },
}));
