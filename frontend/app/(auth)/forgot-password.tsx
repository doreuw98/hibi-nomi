import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import { AuthShell } from "@/src/components/AuthShell";
import { Button, Field } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { api, ApiError } from "@/src/api/client";
import { fonts, fontSize, makeStyles, spacing } from "@/src/theme";

export default function ForgotPassword() {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const requestCode = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErrors({ email: "Enter a valid email" });
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
      toast.show("Check your inbox for the reset code", "info");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Could not request reset", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = "Enter the reset code";
    if (newPassword.length < 6) e.newPassword = "Use at least 6 characters";
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { reset_token: code.trim(), new_password: newPassword },
      });
      toast.show("Password updated! Please sign in", "success");
      router.replace("/(auth)/login");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Could not reset password", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      subtitle={
        step === "request"
          ? "Enter your email and we'll send you a reset code"
          : `We emailed a code to ${email.trim()}. It expires in 15 minutes.`
      }
    >
      {step === "request" ? (
        <>
          <Field
            label="Email"
            testID="forgot-email-input"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Button title="Send reset code" onPress={requestCode} loading={loading} testID="forgot-request-button" />
        </>
      ) : (
        <>
          <Field
            label="Reset code"
            testID="reset-code-input"
            value={code}
            onChangeText={setCode}
            error={errors.code}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="8-character code from your email"
          />
          <Field
            label="New password"
            testID="reset-password-input"
            value={newPassword}
            onChangeText={setNewPassword}
            error={errors.newPassword}
            secureTextEntry
            placeholder="At least 6 characters"
          />
          <Button title="Update password" onPress={resetPassword} loading={loading} testID="reset-submit-button" />
        </>
      )}

      <Pressable style={styles.back} onPress={() => router.replace("/(auth)/login")} testID="back-to-login-link">
        <Text style={styles.backText}>Back to sign in</Text>
      </Pressable>
    </AuthShell>
  );
}

const useStyles = makeStyles((c) => ({
  back: { alignSelf: "center", marginTop: spacing.sm },
  backText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.brandPrimary },
}));
