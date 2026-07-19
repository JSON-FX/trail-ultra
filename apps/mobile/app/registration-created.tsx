import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "../lib/theme";

export default function RegistrationCreated() {
  const { rid } = useLocalSearchParams<{ rid: string }>();
  const router = useRouter();
  return (
    <View style={styles.c}>
      <Text style={styles.h}>You're registered</Text>
      <Text style={styles.sub}>Registration created and pending payment.</Text>
      <Text style={styles.rid}>Ref: {rid}</Text>
      <Text style={styles.note}>Payment and your race ticket arrive in Plan 4.</Text>
      <Pressable style={styles.btn} onPress={() => router.replace("/(tabs)/events")} accessibilityRole="button">
        <Text style={styles.btnT}>Back to events</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", padding: 28, gap: 8 },
  h: { fontSize: 26, fontWeight: "700", color: theme.pine },
  sub: { color: theme.ink, fontSize: 15 },
  rid: { color: theme.inkSoft, fontFamily: "Courier", marginTop: 4 },
  note: { color: theme.inkSoft, textAlign: "center", marginTop: 8 },
  btn: { backgroundColor: theme.pine, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, marginTop: 20 },
  btnT: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
