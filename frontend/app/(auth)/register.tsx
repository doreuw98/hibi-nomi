import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";

import { AuthShell } from "@/src/components/AuthShell";
import { Button, Field } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { useI18n } from "@/src/i18n";
import { fonts, fontSize, makeStyles, spacing } from "@/src/theme";
import { ApiError } from "@/src/api/client";

export default function Register() {
  const styles = useStyles();
  const router = useRouter();
  const { register } = useAuth();
  const toast = useToast();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = t("auth.nameRequired");
    if (!email.trim()) e.email = t("auth.emailRequired");
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = t("auth.emailInvalid");
    if (!password) e.password = t("auth.passwordRequired");
    else if (password.length < 6) e.password = t("auth.passwordMin");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, name.trim());
      toast.show(t("auth.accountCreated"), "success");
      router.replace("/onboarding");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("auth.couldNotCreate");
      toast.show(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={t("auth.registerTitle")} subtitle={t("auth.registerSubtitle")}>
      <Field
        label={t("auth.name")}
        testID="register-name-input"
        value={name}
        onChangeText={setName}
        error={errors.name}
        placeholder={t("auth.namePlaceholder")}
      />
      <Field
        label={t("auth.email")}
        testID="register-email-input"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder={t("auth.emailPlaceholder")}
      />
      <Field
        label={t("auth.password")}
        testID="register-password-input"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        placeholder={t("auth.passwordMin")}
      />

      <Button title={t("auth.registerButton")} onPress={onRegister} loading={loading} testID="register-submit-button" />

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t("auth.haveAccount")}</Text>
        <Link href="/(auth)/login" asChild>
          <Pressable testID="go-to-login-link">
            <Text style={styles.footerLink}>{t("auth.signIn")}</Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}

const useStyles = makeStyles((c) => ({
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.sm },
  footerText: { fontFamily: fonts.medium, color: c.muted, fontSize: fontSize.base },
  footerLink: { fontFamily: fonts.extrabold, color: c.brandPrimary, fontSize: fontSize.base },
}));
