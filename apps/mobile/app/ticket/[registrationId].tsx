import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRegistration } from "../../lib/registration";
import { getCachedTicket, cacheTicket, type CachedTicket } from "../../lib/ticketCache";
import { TicketQR } from "../../components/TicketQR";
import { theme } from "../../lib/theme";

export default function Ticket() {
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  const router = useRouter();
  const [cached, setCached] = useState<CachedTicket | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const reg = useRegistration(registrationId);

  // Offline-first: paint from cache immediately.
  useEffect(() => {
    getCachedTicket(registrationId).then((c) => { setCached(c); setCacheLoaded(true); });
  }, [registrationId]);

  // Refresh the cache when fresh server data confirms paid.
  useEffect(() => {
    if (reg.data?.status === "paid" && reg.data.ticket_token) {
      const t: CachedTicket = {
        rid: reg.data.id, token: reg.data.ticket_token, eventName: reg.data.eventName,
        categoryLabel: reg.data.categoryLabel, runnerName: cached?.runnerName ?? "", status: "paid", orgId: reg.data.org_id,
      };
      cacheTicket(t);
      setCached(t);
    }
  }, [reg.data]);

  const token = reg.data?.ticket_token ?? cached?.token ?? null;
  const eventName = reg.data?.eventName ?? cached?.eventName ?? "";
  const categoryLabel = reg.data?.categoryLabel ?? cached?.categoryLabel ?? "";

  if (!cacheLoaded && reg.isLoading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={styles.c}>
      <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable>
      <Text style={styles.event}>{eventName}</Text>
      <Text style={styles.cat}>{categoryLabel}</Text>
      {token ? (
        <View style={styles.qrWrap}>
          <TicketQR value={token} />
          <Text style={styles.ref}>Ref {registrationId.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.note}>Show this QR at check-in. Works offline.</Text>
        </View>
      ) : (
        <Text style={styles.note}>No ticket yet — complete payment to get your race pass.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: "#fff", padding: 24, paddingTop: 60, alignItems: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  back: { color: theme.pine, alignSelf: "flex-start", marginBottom: 8, fontSize: 15 },
  event: { fontSize: 22, fontWeight: "700", color: theme.ink, textAlign: "center", marginTop: 8 },
  cat: { fontSize: 16, color: theme.inkSoft, marginTop: 2 },
  qrWrap: { alignItems: "center", gap: 12, marginTop: 32, padding: 24, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius.lg },
  ref: { fontFamily: "Courier", color: theme.ink, fontSize: 15, marginTop: 8 },
  note: { color: theme.inkSoft, textAlign: "center", fontSize: 13, marginTop: 24 },
});
