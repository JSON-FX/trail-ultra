import { useState } from "react";
import { View, Pressable, Image } from "react-native";
import { formatAddress } from "@race-pace/shared";
import type { EventRow } from "../lib/events";
import { ElevationHero } from "./ElevationHero";
import { OrgAvatar } from "./OrgAvatar";
import { StatusBadge, eventStatusKind } from "./StatusBadge";
import { shortDate } from "../lib/format";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";

export function EventCard({ event, showOrg = true, onPress }: { event: EventRow; showOrg?: boolean; onPress: () => void }) {
  const cancelled = eventStatusKind(event) === "cancelled";
  const dateLabel = event.event_date ? (cancelled ? `was ${shortDate(event.event_date)}` : shortDate(event.event_date)) : "";
  const meta = [formatAddress(event) || event.place, dateLabel].filter(Boolean).join(" · ");
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card className="rounded-[18px] border border-border overflow-hidden bg-card mb-4 gap-0 py-0 shadow-none shadow-transparent">
        <View>
          {event.hero_image_url && !imgFailed ? (
            <Image testID="event-card-image" source={{ uri: event.hero_image_url }} style={{ height: 132, width: "100%" }} resizeMode="cover" onError={() => setImgFailed(true)} />
          ) : (
            <ElevationHero height={132} />
          )}
          <View className="absolute top-3 left-3"><StatusBadge event={event} /></View>
        </View>
        <View className="p-[14px] px-4">
          <Text className="text-[17px] font-semibold tracking-[-0.2px] text-foreground" numberOfLines={1}>{event.name}</Text>
          {meta ? <Text className="text-[13px] text-muted-foreground mt-[3px]">{meta}</Text> : null}
          {showOrg && event.org_name ? (
            <View className="flex-row items-center gap-[9px] mt-[13px] pt-3 border-t border-divider">
              <OrgAvatar name={event.org_name} color={event.org_color} size={24} />
              <Text className="text-[13px] text-muted-foreground">{event.org_name}</Text>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
