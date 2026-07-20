import { View, Text } from "react-native";
import { theme } from "../lib/theme";

export function initials(name?: string | null): string {
  if (!name) return "?";
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  const two = (words[0]?.[0] ?? "") + (words[1]?.[0] ?? "");
  return (two || words[0]?.slice(0, 2) || "?").toUpperCase();
}

export function OrgAvatar({ name, color, size = 24, radius }: {
  name?: string | null; color?: string | null; size?: number; radius?: number;
}) {
  return (
    <View style={{
      width: size, height: size, borderRadius: radius ?? size / 2,
      backgroundColor: color || theme.primary, alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: Math.max(9, Math.round(size * 0.4)) }}>{initials(name)}</Text>
    </View>
  );
}
