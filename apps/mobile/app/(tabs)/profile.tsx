import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { useOrg } from "../../lib/org";
import { getProfile, upsertProfile } from "../../lib/profile";
import { theme } from "../../lib/theme";

export default function Profile() {
  const { session, signOut } = useAuth();
  const { clearOrg } = useOrg();
  const router = useRouter();
  const uid = session?.user.id;
  const [fullName, setFullName] = useState("");
  const [bibName, setBibName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    getProfile(uid).then((p) => {
      if (p) { setFullName(p.full_name ?? ""); setBibName(p.bib_name ?? ""); setCity(p.city ?? ""); }
    });
  }, [uid]);

  async function save() {
    if (!uid) return;
    setBusy(true);
    const { error } = await upsertProfile({ id: uid, full_name: fullName, bib_name: bibName, city });
    setBusy(false);
    Alert.alert(error ? "Save failed" : "Saved", error ?? "Your profile was updated.");
  }

  async function switchOrg() { await clearOrg(); router.replace("/choose-org"); }
  async function doSignOut() { await clearOrg(); await signOut(); router.replace("/(auth)/sign-in"); }

  return (
    <View style={styles.c}>
      <Text style={styles.h}>Profile</Text>
      <TextInput style={styles.i} placeholder="Full name" placeholderTextColor={theme.inkMuted} value={fullName} onChangeText={setFullName} accessibilityLabel="Full name" />
      <TextInput style={styles.i} placeholder="Bib name" placeholderTextColor={theme.inkMuted} value={bibName} onChangeText={setBibName} accessibilityLabel="Bib name" />
      <TextInput style={styles.i} placeholder="City" placeholderTextColor={theme.inkMuted} value={city} onChangeText={setCity} accessibilityLabel="City" />
      <Pressable style={styles.btn} onPress={save} disabled={busy} accessibilityRole="button"><Text style={styles.btnT}>{busy ? "Saving…" : "Save"}</Text></Pressable>
      <Pressable onPress={switchOrg} accessibilityRole="button"><Text style={styles.link}>Switch organization</Text></Pressable>
      <Pressable onPress={doSignOut} accessibilityRole="button"><Text style={styles.signout}>Sign out</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, padding: 20, paddingTop: 60, gap: 12, backgroundColor: theme.canvas },
  h: { fontSize: 28, fontWeight: "600", letterSpacing: -0.4, color: theme.ink, marginBottom: 8 },
  i: { borderWidth: 1, borderColor: theme.hairline, borderRadius: theme.radius.md, padding: 14, fontSize: 17, color: theme.ink },
  btn: { backgroundColor: theme.primary, borderRadius: theme.radius.pill, paddingVertical: 15, alignItems: "center" },
  btnT: { color: theme.onPrimary, fontWeight: "600", fontSize: 17 },
  link: { color: theme.primary, textAlign: "center", marginTop: 8, fontSize: 17 },
  signout: { color: theme.danger, textAlign: "center", marginTop: 4, fontSize: 17 },
});
