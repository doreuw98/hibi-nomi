import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";

import { AuthShell } from "@/src/components/AuthShell";
import { Button, Field } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { fonts, fontSize, makeStyles, spacing } from "@/src/theme";
import { ApiError } from "@/src/api/client";

export default function Register() {
  const styles = useStyles();
  const router = useRouter();
  const { register } = useAuth();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Use at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, name.trim());
      toast.show("Account created! Let's set you up 💧", "success");
      router.replace("/onboarding");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not create account";
      toast.show(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create account" subtitle="Start building a healthy hydration habit">
      <Field
        label="Name"
        testID="register-name-input"
        value={name}
        onChangeText={setName}
        error={errors.name}
        placeholder="Your name"
      />
      <Field
        label="Email"
        testID="register-email-input"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <Field
        label="Password"
        testID="register-password-input"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        placeholder="At least 6 characters"
      />

      <Button title="Create account" onPress={onRegister} loading={loading} testID="register-submit-button" />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable testID="go-to-login-link">
            <Text style={styles.footerLink}>Sign in</Text>
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
