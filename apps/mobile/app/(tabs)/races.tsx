import { View, Text, StyleSheet } from "react-native";
import { theme } from "../../lib/theme";

export default function MyRaces() {
  return (
    <View style={styles.c}>
      <Text style={styles.h}>My Races</Text>
      <Text style={styles.sub}>Tickets arrive in Plan 4.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, justifyContent: "center", alignItems: "center", gap: 6, backgroundColor: theme.canvas },
  h: { fontSize: 22, fontWeight: "600", color: theme.ink },
  sub: { color: theme.inkMuted },
});
