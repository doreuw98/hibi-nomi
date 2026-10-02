import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: ButtonProps) {
  const styles = useButtonStyles();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === "primary"
      ? styles.primary
      : variant === "secondary"
        ? styles.secondary
        : variant === "danger"
          ? styles.danger
          : styles.ghost;
  const txt =
    variant === "primary"
      ? { color: colors.onBrandPrimary }
      : variant === "secondary"
        ? { color: colors.onBrandTertiary }
        : variant === "danger"
          ? { color: colors.onError }
          : { color: colors.brandPrimary };

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (isDisabled) return;
        haptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        bg,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? "#fff" : colors.brandPrimary} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.text, txt]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useButtonStyles = makeStyles((c) => ({
  base: {
    minHeight: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  primary: { backgroundColor: c.brandPrimary },
  secondary: { backgroundColor: c.brandTertiary },
  danger: { backgroundColor: c.error },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  text: { fontFamily: fonts.extrabold, fontSize: fontSize.lg },
}));

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const styles = useCardStyles();
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

const useCardStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
}));

// ---------------------------------------------------------------------------
// Text input field
// ---------------------------------------------------------------------------
type FieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  testID?: string;
};

export function Field({ label, error, testID, style, ...rest }: FieldProps) {
  const styles = useFieldStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        style={[styles.input, !!error && styles.inputError, style]}
        {...rest}
      />
      {error ? (
        <Text style={styles.error} testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const useFieldStyles = makeStyles((c) => ({
  wrap: { gap: spacing.xs },
  label: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.onSurface },
  input: {
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
    fontFamily: fonts.medium,
    fontSize: fontSize.lg,
    color: c.onSurface,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  inputError: { borderColor: c.error },
  error: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.error },
}));

// ---------------------------------------------------------------------------
// Section title
// ---------------------------------------------------------------------------
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useSectionStyles();
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const useSectionStyles = makeStyles((c) => ({
  wrap: { marginBottom: spacing.sm },
  text: { fontFamily: fonts.extrabold, fontSize: fontSize.xl, color: c.onSurface },
}));

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
export function EmptyState({
  icon,
  title,
  subtitle,
  testID,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  testID?: string;
}) {
  const styles = useEmptyStyles();
  return (
    <View style={styles.wrap} testID={testID}>
      {icon}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const useEmptyStyles = makeStyles((c) => ({
  wrap: { alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  title: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: c.onSurface, textAlign: "center" },
  subtitle: { fontFamily: fonts.medium, fontSize: fontSize.base, color: c.muted, textAlign: "center" },
}));
