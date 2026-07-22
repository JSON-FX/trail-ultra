import { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRegistration } from "../../lib/registration";
import { getCachedTicket, cacheTicket, type CachedTicket } from "../../lib/ticketCache";
import { getProfile } from "../../lib/profile";
import { useAuth } from "../../lib/auth";
import { TicketQR } from "../../components/TicketQR";
import { StatusBanner } from "../../components/StatusBadge";
import { longDate } from "../../lib/format";
import { Text } from "@/components/ui/text";

export default function Ticket() {
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const reg = useRegistration(registrationId);
  const [cached, setCached] = useState<CachedTicket | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string | null; bib_name: string | null } | null>(null);

  useEffect(() => {
    getCachedTicket(registrationId).then((c) => { setCached(c); setCacheLoaded(true); }).catch(() => setCacheLoaded(true));
  }, [registrationId]);

  useEffect(() => {
    if (reg.data?.status === "paid" && reg.data.ticket_token) {
      const t: CachedTicket = { rid: reg.data.id, token: reg.data.ticket_token, eventName: reg.data.eventName, categoryLabel: reg.data.categoryLabel, runnerName: cached?.runnerName ?? "", status: "paid", orgId: reg.data.org_id };
      cacheTicket(t); setCached(t);
    }
    // `cached` intentionally excluded — including it re-triggers this effect on every setCached, looping.
  }, [reg.data]);

  useEffect(() => { if (session?.user.id) getProfile(session.user.id).then((p) => p && setProfile(p)); }, [session?.user.id]);

  const token = reg.data?.ticket_token ?? cached?.token ?? null;
  const eventName = reg.data?.eventName ?? cached?.eventName ?? "";
  const categoryLabel = reg.data?.categoryLabel ?? cached?.categoryLabel ?? "";
  const ref = registrationId.slice(0, 8).toUpperCase();

  if (!cacheLoaded && reg.isLoading) return <View className="flex-1 items-center justify-center bg-muted"><ActivityIndicator className="text-primary" /></View>;

  return (
    <ScrollView className="flex-1 bg-muted" contentContainerStyle={{ paddingTop: insets.top + 6, paddingHorizontal: 22, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" className="py-2"><Text className="text-[15px] font-medium text-primary">‹ My Races</Text></Pressable>

      {reg.data ? <StatusBanner event={{ status: reg.data.eventStatus ?? "open", original_date: reg.data.originalDate, event_date: reg.data.eventDate, status_note: reg.data.statusNote }} /> : null}

      {token ? (
        <>
          <View className="mt-1.5 overflow-hidden rounded-[22px] border border-border bg-card">
            <View className="bg-forest p-[22px]">
              <Text className="text-[11px] font-semibold tracking-[0.5px] text-white/60">RACE PASS · {categoryLabel.toUpperCase()}</Text>
              <Text className="mt-2 text-[22px] font-bold tracking-[-0.3px] text-white">{eventName}</Text>
              {reg.data?.eventDate ? <Text className="mt-[5px] text-[13px] text-white/75">{longDate(reg.data.eventDate)}</Text> : null}
            </View>
            <View className="items-center border-t-[1.5px] border-dashed border-border p-[26px]">
              <View className="rounded-[16px] border border-border bg-white p-[14px]"><TicketQR value={token} size={150} /></View>
              <Text className="mt-[14px] text-[13px] text-muted-foreground" style={{ fontFamily: "Courier", letterSpacing: 1 }}>{ref}</Text>
              <Text className="mt-1.5 text-center text-[13px] text-foreground">Show this QR at check-in. <Text className="font-bold">Works offline.</Text></Text>
            </View>
          </View>

          <View className="mt-[14px] flex-row flex-wrap gap-[10px]">
            <Info label="RUNNER" value={profile?.full_name || "—"} />
            <Info label="BIB" value={profile?.bib_name || ref} />
            <Info label="CATEGORY" value={categoryLabel} />
            <Info label="DISTANCE" value={reg.data?.categoryDistance ? `${reg.data.categoryDistance} KM` : "—"} />
          </View>

          <View className="mt-[14px] flex-row items-center justify-center gap-[10px] rounded-[14px] bg-secondary p-[14px]">
            <View className="h-[11px] w-[11px] rounded-[6px] bg-primary" />
            <Text className="text-[13px] font-semibold text-secondary-foreground">Present QR at start line</Text>
          </View>
        </>
      ) : (
        <Text className="mt-10 text-center text-muted-foreground">No ticket yet — complete payment to get your race pass.</Text>
      )}
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View className="grow basis-[47%] rounded-[14px] border border-border bg-card p-[14px]">
      <Text className="text-[10px] text-muted-foreground">{label}</Text>
      <Text className="mt-[3px] text-[14px] font-semibold text-foreground" numberOfLines={1}>{value}</Text>
    </View>
  );
}
