import { View } from "react-native";
import type { OrgRow } from "../lib/events";
import { Text } from "@/components/ui/text";
import { OrgBanner } from "./OrgBanner";
import { OrgAvatar } from "./OrgAvatar";

export function OrgHeader({ org, eventCount }: { org: OrgRow; eventCount?: number }) {
  const count = eventCount ?? org.event_count ?? 0;
  return (
    <View>
      <OrgBanner height={170} bannerUrl={org.banner_url} />
      <View className="px-[22px]">
        <View className="-mt-[42px] self-start rounded-[26px] border-4 border-background bg-background">
          <OrgAvatar name={org.name} color={org.brand_color} size={84} radius={22} logoUrl={org.logo_url} />
        </View>
        <Text className="mt-3 text-[23px] font-bold tracking-[-0.4px] text-foreground">{org.name}</Text>
        <Text className="mt-[3px] text-[13px] text-muted-foreground">{count} {count === 1 ? "event" : "events"}</Text>
        {org.description ? <Text className="mt-3 text-[14px] leading-[22px] text-foreground">{org.description}</Text> : null}
        <View className="mt-4 flex-row gap-2.5">
          <View className="flex-1 items-center rounded-full bg-primary py-[11px]">
            <Text className="text-[14px] font-semibold text-primary-foreground">Follow</Text>
          </View>
          <View className="flex-1 items-center rounded-full border border-border bg-background py-[11px]">
            <Text className="text-[14px] font-semibold text-foreground">Share</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
