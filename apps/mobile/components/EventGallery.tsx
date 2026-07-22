import { useState } from "react";
import { View, Image, ScrollView, useWindowDimensions } from "react-native";
import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { ElevationHero } from "./ElevationHero";
import { cn } from "@/lib/utils";

/** Horizontal paging carousel of an event's images with a dots indicator.
 *  Falls back to the ElevationHero placeholder when there are no images. */
export function EventGallery({ images, height }: { images: (string | null | undefined)[]; height: number }) {
  const urls = Array.from(new Set(images.filter((u): u is string => !!u)));
  const { width } = useWindowDimensions();
  const [idx, setIdx] = useState(0);
  const [errored, setErrored] = useState<Record<string, boolean>>({});

  if (urls.length === 0) return <ElevationHero height={height} />;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIdx(width > 0 ? Math.round(e.nativeEvent.contentOffset.x / width) : 0);
  };

  return (
    <View style={{ height }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} scrollEventThrottle={16}>
        {urls.map((uri) => (
          errored[uri] ? (
            <View key={uri} style={{ width, height }}><ElevationHero height={height} /></View>
          ) : (
            <Image key={uri} testID="gallery-image" source={{ uri }} style={{ width, height }} resizeMode="cover" onError={() => setErrored((e) => ({ ...e, [uri]: true }))} />
          )
        ))}
      </ScrollView>
      {urls.length > 1 ? (
        <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5" pointerEvents="none">
          {urls.map((uri, i) => (
            <View key={uri} className={cn("h-[7px] w-[7px] rounded-[4px]", i === idx ? "bg-primary" : "bg-muted")} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
