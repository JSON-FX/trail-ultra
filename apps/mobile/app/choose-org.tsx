import { useEffect } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useOrg } from "../lib/org";
import { theme } from "../lib/theme";

export default function ChooseOrg() {
  const { orgs, refreshOrgs, selectOrg } = useOrg();
  const router = useRouter();

  useEffect(() => { refreshOrgs(); }, []);

  async function pick(id: string) {
    await selectOrg(id);
    router.replace("/(tabs)/events");
  }

  return (
    <View style={styles.c}>
      <Text style={styles.h}>Choose an organization</Text>
      <FlatList
        data={orgs}
        keyExtractor={(o) => o.id}
        ListEmptyComponent={<Text style={styles.empty}>No organizations yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={[styles.card, { borderLeftColor: item.brand_color ?? theme.primary }]} onPress={() => pick(item.id)} accessibilityRole="button">
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.slug}>{item.slug}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, padding: 20, paddingTop: 72, backgroundColor: theme.canvas },
  h: { fontSize: 28, fontWeight: "600", letterSpacing: -0.4, color: theme.ink, marginBottom: 16 },
  card: { borderWidth: 1, borderColor: theme.hairline, borderLeftWidth: 5, borderRadius: theme.radius.lg, padding: 18, marginBottom: 12, backgroundColor: theme.canvas },
  name: { fontSize: 18, fontWeight: "600", color: theme.ink },
  slug: { color: theme.inkMuted, marginTop: 2, fontFamily: "Courier" },
  empty: { color: theme.inkMuted },
});
