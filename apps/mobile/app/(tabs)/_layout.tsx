import { Tabs } from "expo-router";
import { theme } from "../../lib/theme";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.primary, headerShown: false }}>
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="orgs" options={{ title: "Orgs" }} />
      <Tabs.Screen name="races" options={{ title: "My Races" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
