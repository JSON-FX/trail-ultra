import { View, Text, StyleSheet } from "react-native";
import type { EventRow } from "../lib/events";
import { longDate } from "../lib/format";
import { theme } from "../lib/theme";

export type StatusKind = "open" | "almost_full" | "closed" | "completed" | "cancelled" | "rescheduled";

export function eventStatusKind(e: Pick<EventRow, "status" | "original_date">): StatusKind {
  if (e.status === "cancelled") return "cancelled";
  if (e.original_date) return "rescheduled";
  return (["almost_full", "closed", "completed"].includes(e.status) ? e.status : "open") as StatusKind;
}
const LABEL: Record<StatusKind, string> = {
  open: "Open", almost_full: "Almost full", closed: "Closed", completed: "Completed", cancelled: "Cancelled", rescheduled: "Rescheduled",
};
export function eventStatusLabel(e: Pick<EventRow, "status" | "original_date">) { return LABEL[eventStatusKind(e)]; }

const TINT: Record<StatusKind, { fg: string; bg: string }> = {
  open: { fg: theme.ink, bg: theme.parchment },
  almost_full: { fg: theme.amber, bg: theme.amberTint },
  closed: { fg: theme.inkMuted, bg: theme.parchment },
  completed: { fg: theme.inkMuted, bg: theme.parchment },
  cancelled: { fg: theme.danger, bg: theme.dangerTint },
  rescheduled: { fg: theme.info, bg: theme.infoTint },
};

export function StatusBadge({ event }: { event: Pick<EventRow, "status" | "original_date"> }) {
  const t = TINT[eventStatusKind(event)];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: theme.radius.pill, paddingVertical: 4, paddingHorizontal: 10, alignSelf: "flex-start" }}>
      <Text style={{ color: t.fg, fontSize: 11, fontWeight: "700" }}>{eventStatusLabel(event)}</Text>
    </View>
  );
}

export function StatusBanner({ event }: { event: Pick<EventRow, "status" | "original_date" | "event_date" | "status_note"> }) {
  const kind = eventStatusKind(event);
  if (kind !== "cancelled" && kind !== "rescheduled") return null;
  const cancelled = kind === "cancelled";
  const fg = cancelled ? theme.danger : theme.info;
  return (
    <View style={[styles.banner, { backgroundColor: cancelled ? theme.dangerTint : theme.infoTint }]}>
      <View style={styles.row}>
        <Text style={[styles.icon, { color: fg }]}>{cancelled ? "⊘" : "↻"}</Text>
        <Text style={[styles.h, { color: fg }]}>
          {cancelled ? "This event was cancelled" : `Rescheduled — new date ${longDate(event.event_date)}`}
        </Text>
      </View>
      {!cancelled && event.original_date ? <Text style={[styles.note, { color: fg, opacity: 0.8 }]}>was {longDate(event.original_date)}</Text> : null}
      {cancelled && event.status_note ? <Text style={styles.note}>{event.status_note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 13, paddingHorizontal: 18 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: { fontSize: 15, lineHeight: 20 },
  h: { fontSize: 14, fontWeight: "600", flex: 1, lineHeight: 20 },
  note: { color: theme.inkMuted, fontSize: 12, marginTop: 3, marginLeft: 25 },
});
