import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { GoogleLogo } from "phosphor-react-native";

import { AuthShell } from "@/src/components/AuthShell";
import { Button, Field } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { fonts, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { ApiError } from "@/src/api/client";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.show("Welcome back! 💧", "success");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not sign in";
      toast.show(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch {
      toast.show("Google sign-in was cancelled", "error");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue your hydration journey">
      <Field
        label="Email"
        testID="login-email-input"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <Field
        label="Password"
        testID="login-password-input"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        placeholder="••••••••"
      />
      <Link href="/(auth)/forgot-password" asChild>
        <Pressable style={styles.forgotWrap} testID="forgot-password-link">
          <Text style={styles.forgot}>Forgot password?</Text>
        </Pressable>
      </Link>

      <Button title="Sign in" onPress={onLogin} loading={loading} testID="login-submit-button" />

      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.or}>or</Text>
        <View style={styles.line} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.google, pressed && { opacity: 0.85 }]}
        onPress={onGoogle}
        testID="google-login-button"
      >
        <GoogleLogo size={22} color={colors.onSurface} weight="bold" />
        <Text style={styles.googleText}>{googleLoading ? "Opening…" : "Continue with Google"}</Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>New here? </Text>
        <Link href="/(auth)/register" asChild>
          <Pressable testID="go-to-register-link">
            <Text style={styles.footerLink}>Create an account</Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}

const useStyles = makeStyles((c) => ({
  forgotWrap: { alignSelf: "flex-end" },
  forgot: { fontFamily: fonts.bold, fontSize: fontSize.base, color: c.brandPrimary },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.xs },
  line: { flex: 1, height: 1, backgroundColor: c.border },
  or: { fontFamily: fonts.medium, color: c.muted, fontSize: fontSize.base },
  google: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 54,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
  },
  googleText: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: c.onSurface },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.sm },
  footerText: { fontFamily: fonts.medium, color: c.muted, fontSize: fontSize.base },
  footerLink: { fontFamily: fonts.extrabold, color: c.brandPrimary, fontSize: fontSize.base },
}));
