import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOrg, useEventsByOrg } from "../../lib/events";
import { OrgHeader } from "../../components/OrgHeader";
import { EventCard } from "../../components/EventCard";
import { theme } from "../../lib/theme";

export default function OrgPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const org = useOrg(id);
  const events = useEventsByOrg(id);

  if (org.isLoading) return <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>;
  if (!org.data) return <View style={styles.center}><Text style={styles.meta}>Organization not found.</Text></View>;

  return (
    <View style={styles.c}>
      <FlatList
        style={styles.list}
        data={events.data ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <OrgHeader org={org.data} eventCount={events.data?.length} />
            <Text style={styles.section}>Events</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No events yet.</Text>}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 22 }}>
            <EventCard event={item} showOrg={false} onPress={() => router.push(`/event/${item.id}`)} />
          </View>
        )}
      />
      <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + 4 }]} accessibilityRole="button"><Text style={styles.backIcon}>‹</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.canvas },
  list: { flex: 1, backgroundColor: theme.canvas },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.canvas },
  section: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3, color: theme.ink, paddingHorizontal: 22, marginTop: 22, marginBottom: 12 },
  backBtn: { position: "absolute", left: 18, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 20, color: theme.ink, marginTop: -2 },
  meta: { color: theme.inkMuted, fontSize: 13 },
  empty: { color: theme.inkMuted, paddingHorizontal: 22 },
});
