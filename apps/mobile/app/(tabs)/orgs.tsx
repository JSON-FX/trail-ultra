import { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useOrgs } from "../../lib/events";
import { OrgAvatar } from "../../components/OrgAvatar";
import { theme } from "../../lib/theme";

export default function Orgs() {
  const { data, isLoading, isError, refetch } = useOrgs();
  const router = useRouter();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const list = data ?? [];
    const n = q.trim().toLowerCase();
    return n ? list.filter((o) => o.name.toLowerCase().includes(n) || (o.description ?? "").toLowerCase().includes(n)) : list;
  }, [data, q]);

  if (isLoading) return <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>;
  if (isError) {
    return <View style={styles.center}><Pressable onPress={() => refetch()} accessibilityRole="button"><Text style={styles.err}>Couldn't load. Tap to retry.</Text></Pressable></View>;
  }

  return (
    <FlatList
      style={styles.list}
      data={rows}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: 22, marginBottom: 8 }}>
          <Text style={styles.h}>Organizations</Text>
          <View style={styles.search}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="Search organizations" placeholderTextColor={theme.inkSubtle} autoCapitalize="none" accessibilityLabel="Search organizations" />
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No organizations yet.</Text>}
      renderItem={({ item }) => {
        const count = item.event_count ?? 0;
        return (
          <Pressable style={styles.row} onPress={() => router.push(`/org/${item.id}`)} accessibilityRole="button">
            <OrgAvatar name={item.name} color={item.brand_color} size={48} radius={14} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{count} {count === 1 ? "event" : "events"}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        );
      }}
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
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15, paddingHorizontal: 22, borderTopWidth: 1, borderTopColor: theme.divider },
  name: { fontSize: 15, fontWeight: "600", color: theme.ink },
  meta: { fontSize: 13, color: theme.inkMuted, marginTop: 2 },
  chevron: { color: theme.inkFaint, fontSize: 20 },
  empty: { color: theme.inkMuted, paddingHorizontal: 22 },
  err: { color: theme.stop },
});
