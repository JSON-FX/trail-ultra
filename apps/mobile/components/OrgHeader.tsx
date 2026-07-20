import { View, Text, StyleSheet } from "react-native";
import type { OrgRow } from "../lib/events";
import { OrgBanner } from "./OrgBanner";
import { OrgAvatar } from "./OrgAvatar";
import { theme } from "../lib/theme";

export function OrgHeader({ org, eventCount }: { org: OrgRow; eventCount?: number }) {
  const count = eventCount ?? org.event_count ?? 0;
  return (
    <View>
      <OrgBanner height={170} />
      <View style={styles.body}>
        <View style={styles.avatarRing}>
          <OrgAvatar name={org.name} color={org.brand_color} size={84} radius={22} />
        </View>
        <Text style={styles.name}>{org.name}</Text>
        <Text style={styles.meta}>{count} {count === 1 ? "event" : "events"}</Text>
        {org.description ? <Text style={styles.about}>{org.description}</Text> : null}
        <View style={styles.actions}>
          <View style={styles.follow}><Text style={styles.followT}>Follow</Text></View>
          <View style={styles.share}><Text style={styles.shareT}>Share</Text></View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 22 },
  avatarRing: { alignSelf: "flex-start", borderRadius: 26, borderWidth: 4, borderColor: theme.canvas, backgroundColor: theme.canvas, marginTop: -42 },
  name: { fontSize: 23, fontWeight: "700", letterSpacing: -0.4, color: theme.ink, marginTop: 12 },
  meta: { fontSize: 13, color: theme.inkMuted, marginTop: 3 },
  about: { fontSize: 14, color: theme.ink, lineHeight: 22, marginTop: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  follow: { flex: 1, backgroundColor: theme.primary, borderRadius: theme.radius.pill, paddingVertical: 11, alignItems: "center" },
  followT: { color: "#fff", fontSize: 14, fontWeight: "600" },
  share: { flex: 1, backgroundColor: theme.canvas, borderWidth: 1, borderColor: theme.hairline, borderRadius: theme.radius.pill, paddingVertical: 11, alignItems: "center" },
  shareT: { color: theme.ink, fontSize: 14, fontWeight: "600" },
});
