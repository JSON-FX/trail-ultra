import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { formatPeso } from "@race-pace/shared";
import { useRegistration } from "../../lib/registration";
import { cacheTicket } from "../../lib/ticketCache";
import { theme } from "../../lib/theme";

const TIMEOUT_MS = 90_000;
// Deliberately NOT "pay/return" — that would collide with this pay/[registrationId] route.
const RETURN_PATH = "pay-callback";

export default function Pay() {
  const { registrationId, checkoutUrl } = useLocalSearchParams<{ registrationId: string; checkoutUrl?: string }>();
  const router = useRouter();
  const [awaiting, setAwaiting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reg = useRegistration(registrationId, { poll: awaiting });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const paid = reg.data?.status === "paid";
  const url = checkoutUrl ?? reg.data?.checkoutUrl ?? null;

  // Cache the ticket the instant payment confirms (guaranteed-offline).
  useEffect(() => {
    if (paid && reg.data) {
      cacheTicket({
        rid: reg.data.id, token: reg.data.ticket_token, eventName: reg.data.eventName,
        categoryLabel: reg.data.categoryLabel, runnerName: "", status: "paid", orgId: reg.data.org_id,
      });
      if (timer.current) clearTimeout(timer.current);
    }
  }, [paid, reg.data]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function pay() {
    if (!url) { setErr("No checkout link available. Go back and try again."); return; }
    setErr(null);
    const redirect = Linking.createURL(RETURN_PATH);
    const full = url + (url.includes("?") ? "&" : "?") + "return=" + encodeURIComponent(redirect);
    try {
      // We do NOT trust the result — confirmation comes from polling the webhook-set status.
      await WebBrowser.openAuthSessionAsync(full, redirect);
    } catch {
      // ignore; polling drives the outcome
    }
    setTimedOut(false);
    setAwaiting(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
  }

  if (paid) {
    return (
      <View style={styles.c}>
        <Text style={styles.big}>Payment confirmed</Text>
        <Text style={styles.sub}>{reg.data?.eventName} — {reg.data?.categoryLabel}</Text>
        <Pressable style={styles.btn} onPress={() => router.replace(`/ticket/${registrationId}`)} accessibilityRole="button">
          <Text style={styles.btnT}>View ticket</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.c}>
      <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable>
      <Text style={styles.h}>Payment</Text>
      {reg.data ? <Text style={styles.sub}>{reg.data.eventName} — {reg.data.categoryLabel}</Text> : null}
      {reg.data ? <Text style={styles.total}>{formatPeso(reg.data.total_amount)}</Text> : null}

      {awaiting ? (
        <View style={styles.pending}>
          <ActivityIndicator />
          <Text style={styles.sub}>Waiting for payment confirmation…</Text>
          {timedOut ? <Text style={styles.note}>Still processing. If you completed payment, tap Check again.</Text> : null}
          <Pressable style={styles.secondary} onPress={() => reg.refetch()} accessibilityRole="button"><Text style={styles.secondaryT}>Check again</Text></Pressable>
          <Pressable style={styles.secondary} onPress={pay} accessibilityRole="button"><Text style={styles.secondaryT}>Retry payment</Text></Pressable>
        </View>
      ) : (
        <Pressable style={styles.btn} onPress={pay} accessibilityRole="button">
          <Text style={styles.btnT}>Pay now</Text>
        </Pressable>
      )}
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: "#fff", padding: 24, paddingTop: 60 },
  back: { color: theme.pine, marginBottom: 8, fontSize: 15 },
  h: { fontSize: 24, fontWeight: "700", color: theme.ink },
  big: { fontSize: 26, fontWeight: "700", color: theme.pine, textAlign: "center", marginTop: 40 },
  sub: { color: theme.inkSoft, marginTop: 6, fontSize: 15, textAlign: "center" },
  total: { fontSize: 34, fontWeight: "700", color: theme.ink, marginTop: 12, textAlign: "center" },
  pending: { alignItems: "center", gap: 12, marginTop: 32 },
  note: { color: theme.inkSoft, textAlign: "center", fontSize: 13 },
  btn: { backgroundColor: theme.pine, borderRadius: theme.radius.pill, padding: 16, alignItems: "center", marginTop: 32 },
  btnT: { color: "#fff", fontWeight: "600", fontSize: 16 },
  secondary: { paddingVertical: 10 },
  secondaryT: { color: theme.pine, fontSize: 15, fontWeight: "600" },
  err: { color: theme.stop, marginTop: 16, textAlign: "center" },
});
