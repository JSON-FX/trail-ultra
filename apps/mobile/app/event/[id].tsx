import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { formatPeso } from "@trail-ultra/shared";
import { useEvent, useCategories } from "../../lib/events";
import { theme } from "../../lib/theme";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const ev = useEvent(id);
  const cats = useCategories(id);

  if (ev.isLoading || cats.isLoading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={styles.c}>
      <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>‹ Events</Text></Pressable>
      <Text style={styles.h}>{ev.data?.name ?? "Event"}</Text>
      <Text style={styles.meta}>{[ev.data?.place, ev.data?.region].filter(Boolean).join(" · ")}</Text>
      <Text style={styles.section}>Pick a distance</Text>
      <FlatList
        data={cats.data ?? []}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={<Text style={styles.meta}>No categories open.</Text>}
        renderItem={({ item }) => {
          const left = item.slots_total - item.slots_taken;
          const soldOut = left <= 0;
          return (
            <Pressable
              style={[styles.cat, soldOut && styles.catDisabled]}
              disabled={soldOut}
              onPress={() => router.push(`/register/${item.id}`)}
              accessibilityRole="button"
            >
              <View>
                <Text style={styles.catLabel}>{item.label}</Text>
                <Text style={styles.meta}>{soldOut ? "Sold out" : `${left} slots left`}</Text>
              </View>
              <Text style={styles.price}>{formatPeso(item.base_price)}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: "#fff", padding: 20, paddingTop: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  back: { color: theme.pine, marginBottom: 8, fontSize: 15 },
  h: { fontSize: 24, fontWeight: "700", color: theme.ink },
  meta: { color: theme.inkSoft, marginTop: 3, fontSize: 13 },
  section: { fontSize: 16, fontWeight: "600", marginTop: 18, marginBottom: 10, color: theme.ink },
  cat: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: theme.line, borderRadius: 12, padding: 16, marginBottom: 10 },
  catDisabled: { opacity: 0.45 },
  catLabel: { fontSize: 17, fontWeight: "600", color: theme.ink },
  price: { fontSize: 16, fontWeight: "700", color: theme.pine },
});
