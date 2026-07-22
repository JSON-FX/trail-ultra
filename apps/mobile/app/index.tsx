import { Redirect } from "expo-router";
import { ActivityIndicator, Image, View } from "react-native";
import { useAuth } from "../lib/auth";

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Image source={require("../assets/topnav-logo.png")} style={{ width: 72, height: 72 }} resizeMode="contain" accessibilityLabel="Race Pace" />
        <ActivityIndicator className="text-primary" style={{ marginTop: 20 }} />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(tabs)/events" />;
}
