import { View, Text, StyleSheet } from "react-native";
export default function Events() {
  return (
    <View style={styles.c}>
      <Text style={styles.h}>Events</Text>
      <Text style={styles.sub}>Browsing arrives in Plan 3.</Text>
    </View>
  );
}
const styles = StyleSheet.create({ c: { flex: 1, justifyContent: "center", alignItems: "center", gap: 6 }, h: { fontSize: 22, fontWeight: "600" }, sub: { color: "#8A968C" } });
