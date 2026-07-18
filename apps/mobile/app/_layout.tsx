import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../lib/auth";
import { OrgProvider } from "../lib/org";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OrgProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </OrgProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
