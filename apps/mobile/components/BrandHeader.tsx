import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Path } from "react-native-svg";
import { theme } from "../lib/theme";

const MARK = require("../assets/topnav-logo.png");
const BAR_HEIGHT = 52;

function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

// App brand bar shown across the tab shell: mark + app name grouped on the left,
// a notifications action on the right. Owns the top safe-area inset (screens
// below use a small top padding).
export function BrandHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: BAR_HEIGHT + insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.brand}>
        <Image source={MARK} style={styles.mark} resizeMode="contain" />
        <Text style={styles.name}>Race Pace</Text>
      </View>
      <Pressable style={styles.bell} accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={10} onPress={() => {}}>
        <BellIcon color={theme.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    backgroundColor: theme.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.divider,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 30, height: 30 },
  name: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: theme.ink },
  bell: { padding: 4 },
});
