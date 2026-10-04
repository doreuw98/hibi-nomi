import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import { AuthShell } from "@/src/components/AuthShell";
import { Button, Field } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { useI18n } from "@/src/i18n";
import { api, ApiError } from "@/src/api/client";
import { fonts, fontSize, makeStyles, spacing } from "@/src/theme";

export default function ForgotPassword() {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const requestCode = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErrors({ email: t("auth.emailInvalid") });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });
      setStep("reset");
      toast.show(t("auth.checkInbox"), "info");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : t("auth.couldNotRequest"), "error");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = t("auth.codeRequired");
    if (newPassword.length < 6) e.newPassword = t("auth.passwordMin");
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { reset_token: code.trim(), new_password: newPassword },
      });
      toast.show(t("auth.passwordUpdated"), "success");
      router.replace("/(auth)/login");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : t("auth.couldNotReset"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t("auth.resetTitle")}
      subtitle={
        step === "request" ? t("auth.resetSubtitleRequest") : t("auth.resetSubtitleCode", { email: email.trim() })
      }
    >
      {step === "request" ? (
        <>
          <Field
            label={t("auth.email")}
            testID="forgot-email-input"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t("auth.emailPlaceholder")}
          />
          <Button title={t("auth.sendCode")} onPress={requestCode} loading={loading} testID="forgot-request-button" />
        </>
      ) : (
        <>
          <Field
            label={t("auth.resetCode")}
            testID="reset-code-input"
            value={code}
            onChangeText={setCode}
            error={errors.code}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={t("auth.resetCodePlaceholder")}
          />
          <Field
            label={t("auth.newPassword")}
            testID="reset-password-input"
            value={newPassword}
            onChangeText={setNewPassword}
            error={errors.newPassword}
            secureTextEntry
            placeholder={t("auth.passwordMin")}
          />
          <Button title={t("auth.updatePassword")} onPress={resetPassword} loading={loading} testID="reset-submit-button" />
        </>
      )}

      <Pressable style={styles.back} onPress={() => router.replace("/(auth)/login")} testID="back-to-login-link">
        <Text style={styles.backText}>{t("auth.backToSignIn")}</Text>
      </Pressable>
    </AuthShell>
  );
}

const useStyles = makeStyles((c) => ({
  back: { alignSelf: "center", marginTop: spacing.sm },
  backText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.brandPrimary },
}));
