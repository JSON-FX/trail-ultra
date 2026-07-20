import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { StatusBar } from "expo-status-bar";
import { Link, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { theme } from "../../lib/theme";

const BG_VIDEO = require("../../assets/racepace-login-bg.mp4");
const LOGO = require("../../assets/login-logo.png");

// Dim the footage so the wordmark + form read clearly. Higher = darker bg,
// logo pops more. Tune between 0 (raw video) and 1 (solid).
const SCRIM_OPACITY = 0.55;
const SCRIM = "#0A1A13"; // forest-black wash
const FIELD_PLACEHOLDER = "rgba(255,255,255,0.7)";

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const player = useVideoPlayer(BG_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  async function onSubmit() {
    setBusy(true); setError(null);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
    else router.replace("/");
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="cover" nativeControls={false} />
      <View style={[styles.scrim, { opacity: SCRIM_OPACITY }]} pointerEvents="none" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.heroWrap}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Race Pace" />
          </View>
          <View style={styles.form}>
            <TextInput style={styles.i} placeholder="Email" placeholderTextColor={FIELD_PLACEHOLDER} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} accessibilityLabel="Email" />
            <TextInput style={styles.i} placeholder="Password" placeholderTextColor={FIELD_PLACEHOLDER} secureTextEntry value={password} onChangeText={setPassword} accessibilityLabel="Password" />
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <Pressable style={styles.btn} onPress={onSubmit} disabled={busy} accessibilityRole="button">
              <Text style={styles.btnT}>{busy ? "Signing in…" : "Sign in"}</Text>
            </Pressable>
            <Text style={styles.social}>Apple · Google · Facebook — coming soon</Text>
            <Link href="/(auth)/sign-up" style={styles.link}>Create an account</Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.forest },
  flex: { flex: 1 },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: SCRIM },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: "flex-end" },
  heroWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  logo: { width: "64%", aspectRatio: 3.31, maxHeight: 84 },
  form: { gap: 12 },
  i: { borderWidth: 1, borderColor: "rgba(255,255,255,0.28)", borderRadius: theme.radius.md, padding: 15, fontSize: 17, color: "#fff", backgroundColor: "rgba(255,255,255,0.12)" },
  btn: { backgroundColor: theme.primary, borderRadius: theme.radius.pill, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  btnT: { color: theme.onPrimary, fontWeight: "600", fontSize: 17 },
  err: { color: "#FF6B61", fontSize: 14 },
  social: { color: "rgba(255,255,255,0.65)", textAlign: "center", marginTop: 10, fontSize: 13 },
  link: { color: "#fff", textAlign: "center", marginTop: 6, fontSize: 16, fontWeight: "600" },
});
