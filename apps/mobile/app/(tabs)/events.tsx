import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useOrg } from "../../lib/org";
import { useEvents } from "../../lib/events";
import { theme } from "../../lib/theme";

export default function Events() {
  const { selectedOrgId } = useOrg();
  const { data, isLoading, isError, refetch } = useEvents(selectedOrgId);
  const router = useRouter();

  if (isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (isError) {
    return (
      <View style={styles.center}>
        <Pressable onPress={() => refetch()} accessibilityRole="button">
          <Text style={styles.err}>Couldn't load events. Tap to retry.</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <FlatList
      style={styles.list}
      data={data ?? []}
      keyExtractor={(e) => e.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      ListEmptyComponent={<Text style={styles.empty}>No events yet.</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/event/${item.id}`)} accessibilityRole="button">
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>{[item.place, item.region].filter(Boolean).join(" · ")}</Text>
          <Text style={styles.meta}>
            {item.event_date ?? ""}{item.elevation_gain_m ? ` · ${item.elevation_gain_m} m gain` : ""}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { borderWidth: 1, borderColor: theme.line, borderRadius: 14, padding: 16, marginBottom: 12 },
  name: { fontSize: 18, fontWeight: "600", color: theme.ink },
  meta: { color: theme.inkSoft, marginTop: 3, fontSize: 13 },
  empty: { color: theme.inkSoft }, err: { color: theme.stop },
});
