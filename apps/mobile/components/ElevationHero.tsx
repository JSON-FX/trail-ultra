import { useRef } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Polygon, Polyline, Circle } from "react-native-svg";
import { useColorScheme } from "nativewind";

// Stylised elevation profile used as the event "hero" art (matches the design's elev()).
const PTS = "0,120 30,96 60,108 95,62 130,84 165,32 200,56 235,20 270,48 305,30 340,72 390,90";
let _gid = 0;

// react-native-svg primitives take paint props, not NativeWind classNames, so the
// silhouette's colors are picked in JS from the active color scheme. Light keeps the
// original trail-green-on-mint look; dark swaps in a desaturated/lower-key green so the
// placeholder reads as a subtle card decoration instead of a bright patch glowing on a
// dark card (the old hardcoded colors ignored scheme entirely).
const PALETTE = {
  light: { line: "#159A55", marker: "#EA580C" },
  dark: { line: "#3C8562", marker: "#C2410C" },
} as const;

export function ElevationHero({ height, stroke }: { height: number; stroke?: string }) {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";
  const line = stroke ?? PALETTE[scheme].line;
  const marker = PALETTE[scheme].marker;
  const idRef = useRef<string | undefined>(undefined);
  if (!idRef.current) idRef.current = `eg${_gid++}`;
  const id = idRef.current;
  return (
    <View className="bg-secondary" style={{ height }}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 130" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={line} stopOpacity={0.22} />
            <Stop offset="1" stopColor={line} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Polygon points={`0,130 ${PTS} 390,130`} fill={`url(#${id})`} />
        <Polyline points={PTS} fill="none" stroke={line} strokeWidth={2.4} strokeLinejoin="round" />
        <Circle cx={165} cy={32} r={3.5} fill={marker} />
        <Circle cx={235} cy={20} r={3.5} fill={marker} />
      </Svg>
    </View>
  );
}
