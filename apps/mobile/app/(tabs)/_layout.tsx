import { Tabs } from "expo-router";
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#1F6248" }}>
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="races" options={{ title: "My Races" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
