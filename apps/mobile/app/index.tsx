import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/auth";
import { useOrg } from "../lib/org";

export default function Index() {
  const { session, loading: authLoading } = useAuth();
  const { selectedOrgId, loading: orgLoading } = useOrg();

  if (authLoading || orgLoading) {
    return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!selectedOrgId) return <Redirect href="/choose-org" />;
  return <Redirect href="/(tabs)/events" />;
}
