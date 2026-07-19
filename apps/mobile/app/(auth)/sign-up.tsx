import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { theme } from "../../lib/theme";

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true); setError(null);
    const { error } = await signUp(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
    else router.replace("/");
  }

  return (
    <View style={styles.c}>
      <Text style={styles.h}>Create account</Text>
      <TextInput style={styles.i} placeholder="Email" placeholderTextColor={theme.inkMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} accessibilityLabel="Email" />
      <TextInput style={styles.i} placeholder="Password (min 6)" placeholderTextColor={theme.inkMuted} secureTextEntry value={password} onChangeText={setPassword} accessibilityLabel="Password" />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable style={styles.btn} onPress={onSubmit} disabled={busy} accessibilityRole="button">
        <Text style={styles.btnT}>{busy ? "Creating…" : "Create account"}</Text>
      </Pressable>
      <Link href="/(auth)/sign-in" style={styles.link}>I already have an account</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: theme.canvas },
  h: { fontSize: 32, fontWeight: "600", letterSpacing: -0.5, color: theme.ink, marginBottom: 8 },
  i: { borderWidth: 1, borderColor: theme.hairline, borderRadius: theme.radius.md, padding: 14, fontSize: 17, color: theme.ink, backgroundColor: theme.canvas },
  btn: { backgroundColor: theme.primary, borderRadius: theme.radius.pill, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  btnT: { color: theme.onPrimary, fontWeight: "600", fontSize: 17 },
  err: { color: theme.danger },
  link: { color: theme.primary, textAlign: "center", marginTop: 8, fontSize: 17 },
});
