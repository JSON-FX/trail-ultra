import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";

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
      <TextInput style={styles.i} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} accessibilityLabel="Email" />
      <TextInput style={styles.i} placeholder="Password (min 6)" secureTextEntry value={password} onChangeText={setPassword} accessibilityLabel="Password" />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable style={styles.btn} onPress={onSubmit} disabled={busy} accessibilityRole="button">
        <Text style={styles.btnT}>{busy ? "Creating…" : "Create account"}</Text>
      </Pressable>
      <Link href="/(auth)/sign-in" style={styles.link}>I already have an account</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  h: { fontSize: 28, fontWeight: "600", marginBottom: 8 },
  i: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 14, fontSize: 16 },
  btn: { backgroundColor: "#1F6248", borderRadius: 10, padding: 15, alignItems: "center", marginTop: 4 },
  btnT: { color: "#fff", fontWeight: "600", fontSize: 16 },
  err: { color: "#C1492C" },
  link: { color: "#1F6248", textAlign: "center", marginTop: 8 },
});
