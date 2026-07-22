import { View, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOrg, useEventsByOrg } from "../../lib/events";
import { OrgHeader } from "../../components/OrgHeader";
import { EventCard } from "../../components/EventCard";
import { Text } from "@/components/ui/text";

export default function OrgPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const org = useOrg(id);
  const events = useEventsByOrg(id);

  if (org.isLoading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator className="text-primary" /></View>;
  if (!org.data) return <View className="flex-1 items-center justify-center bg-background"><Text className="text-muted-foreground text-[13px]">Organization not found.</Text></View>;

  return (
    <View className="flex-1 bg-background">
      <FlatList
        className="flex-1 bg-background"
        data={events.data ?? []}
        keyExtractor={(e) => e.id}
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <OrgHeader org={org.data} eventCount={events.data?.length} />
            <Text className="text-lg font-bold tracking-[-0.3px] px-[22px] mt-[22px] mb-3 text-foreground">Events</Text>
          </View>
        }
        ListEmptyComponent={<Text className="text-muted-foreground px-[22px]">No events yet.</Text>}
        renderItem={({ item }) => (
          <View className="px-[22px]">
            <EventCard event={item} showOrg={false} onPress={() => router.push(`/event/${item.id}`)} />
          </View>
        )}
      />
      <Pressable
        onPress={() => router.back()}
        className="absolute left-[18px] w-9 h-9 rounded-full bg-white/90 items-center justify-center"
        style={{ top: insets.top + 4 }}
        accessibilityRole="button"
      >
        <Text className="text-[20px] text-[#1D1D1F] -mt-[2px]">‹</Text>
      </Pressable>
    </View>
  );
}
