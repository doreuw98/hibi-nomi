import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, Warning, Info } from "phosphor-react-native";

import { fonts, fontSize, radius, spacing, useTheme } from "@/src/theme";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; message: string; kind: ToastKind };

type ToastState = { show: (message: string, kind?: ToastKind) => void };

const ToastContext = createContext<ToastState | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const bg = {
    success: colors.success,
    error: colors.error,
    info: colors.info,
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View
        pointerEvents="none"
        style={[styles.wrap, { top: insets.top + spacing.sm }]}
        testID="toast-container"
      >
        {toasts.map((t) => (
          <Animated.View
            key={t.id}
            entering={FadeInUp.springify()}
            exiting={FadeOutUp}
            style={[styles.toast, { backgroundColor: bg[t.kind] }]}
            testID={`toast-${t.kind}`}
          >
            {t.kind === "success" ? (
              <CheckCircle size={20} color="#FFFFFF" weight="fill" />
            ) : t.kind === "error" ? (
              <Warning size={20} color="#FFFFFF" weight="fill" />
            ) : (
              <Info size={20} color="#FFFFFF" weight="fill" />
            )}
            <Text style={styles.text}>{t.message}</Text>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    maxWidth: 420,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: fontSize.base,
    flexShrink: 1,
  },
});

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
