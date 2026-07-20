import { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMarketplaceEvents } from "../../lib/events";
import { EventCard } from "../../components/EventCard";
import { theme } from "../../lib/theme";

export default function Marketplace() {
  const { data, isLoading, isError, refetch } = useMarketplaceEvents();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const list = data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((e) => [e.name, e.place, e.region, e.org_name].filter(Boolean).some((s) => s!.toLowerCase().includes(needle)));
  }, [data, q]);

  if (isLoading) return <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>;
  if (isError) {
    return <View style={styles.center}><Pressable onPress={() => refetch()} accessibilityRole="button"><Text style={styles.err}>Couldn't load events. Tap to retry.</Text></Pressable></View>;
  }

  return (
    <FlatList
      style={styles.list}
      data={rows}
      keyExtractor={(e) => e.id}
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: insets.top + 6, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.h}>Events</Text>
          <View style={styles.search}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="Search by name or place" placeholderTextColor={theme.inkSubtle} autoCapitalize="none" accessibilityLabel="Search events" />
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><Text style={{ fontSize: 30, color: theme.inkFaint }}>⌕</Text></View>
          <Text style={styles.emptyH}>No events found</Text>
          <Text style={styles.emptySub}>{q ? "Try a different search." : "Check back soon — new races drop weekly."}</Text>
        </View>
      }
      renderItem={({ item }) => <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: theme.canvas },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.canvas },
  h: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5, color: theme.ink },
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.parchment, borderRadius: theme.radius.md, paddingVertical: 12, paddingHorizontal: 14, marginTop: 14 },
  searchIcon: { color: theme.inkSubtle, fontSize: 17 },
  searchInput: { flex: 1, fontSize: 15, color: theme.ink, padding: 0 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { width: 74, height: 74, borderRadius: 37, backgroundColor: theme.parchment, alignItems: "center", justifyContent: "center" },
  emptyH: { fontSize: 18, fontWeight: "600", color: theme.ink, marginTop: 18 },
  emptySub: { color: theme.inkMuted, fontSize: 14, marginTop: 6, textAlign: "center", maxWidth: 240 },
  err: { color: theme.stop },
});
