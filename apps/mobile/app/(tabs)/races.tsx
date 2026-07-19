import { useEffect } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useOrg } from "../../lib/org";
import { useMyRegistrations } from "../../lib/registration";
import { cacheMyRaces } from "../../lib/ticketCache";
import { theme } from "../../lib/theme";

export default function MyRaces() {
  const { selectedOrgId } = useOrg();
  const { data, isLoading, isError, refetch } = useMyRegistrations(selectedOrgId);
  const router = useRouter();

  // Write-through cache so the list survives going offline.
  useEffect(() => {
    if (selectedOrgId && data) {
      cacheMyRaces(selectedOrgId, data.map((r) => ({
        rid: r.id, token: r.ticket_token, eventName: r.eventName, categoryLabel: r.categoryLabel,
        runnerName: "", status: r.status, orgId: r.org_id,
      })));
    }
  }, [data, selectedOrgId]);

  if (isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (isError) {
    return (
      <View style={styles.center}>
        <Pressable onPress={() => refetch()} accessibilityRole="button"><Text style={styles.err}>Couldn't load. Tap to retry.</Text></Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={data ?? []}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      ListHeaderComponent={<Text style={styles.h}>My Races</Text>}
      ListEmptyComponent={<Text style={styles.empty}>No registrations yet.</Text>}
      renderItem={({ item }) => {
        const paid = item.status === "paid";
        return (
          <Pressable
            style={styles.card}
            onPress={() => router.push(paid ? `/ticket/${item.id}` : `/pay/${item.id}`)}
            accessibilityRole="button"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.eventName}</Text>
              <Text style={styles.meta}>{item.categoryLabel}</Text>
            </View>
            <View style={[styles.badge, paid ? styles.badgePaid : styles.badgePending]}>
              <Text style={[styles.badgeT, paid ? styles.badgeTPaid : styles.badgeTPending]}>{paid ? "Paid" : "Pending"}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: theme.canvas },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  h: { fontSize: 28, fontWeight: "600", letterSpacing: -0.4, color: theme.ink, marginBottom: 12 },
  card: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: theme.hairline, borderRadius: theme.radius.lg, padding: 16, marginBottom: 12 },
  name: { fontSize: 17, fontWeight: "600", color: theme.ink },
  meta: { color: theme.inkMuted, marginTop: 3, fontSize: 13 },
  badge: { borderRadius: theme.radius.pill, paddingVertical: 5, paddingHorizontal: 12 },
  badgePaid: { backgroundColor: "#e7f3ff" },
  badgePending: { backgroundColor: theme.parchment },
  badgeT: { fontSize: 12, fontWeight: "700" },
  badgeTPaid: { color: theme.primary },
  badgeTPending: { color: theme.inkMuted },
  empty: { color: theme.inkMuted },
  err: { color: theme.stop },
});
