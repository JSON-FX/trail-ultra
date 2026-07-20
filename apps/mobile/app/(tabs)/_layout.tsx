import { Tabs } from "expo-router";
import { BrandHeader } from "../../components/BrandHeader";
import { theme } from "../../lib/theme";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.primary, headerShown: true, header: () => <BrandHeader /> }}>
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="orgs" options={{ title: "Orgs" }} />
      <Tabs.Screen name="races" options={{ title: "My Races" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
