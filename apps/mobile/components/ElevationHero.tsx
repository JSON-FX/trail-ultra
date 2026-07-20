import { useRef } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Polygon, Polyline, Circle } from "react-native-svg";
import { theme } from "../lib/theme";

// Stylised elevation profile used as the event "hero" art (matches the design's elev()).
const PTS = "0,120 30,96 60,108 95,62 130,84 165,32 200,56 235,20 270,48 305,30 340,72 390,90";
let _gid = 0;

export function ElevationHero({ height, stroke = theme.primary }: { height: number; stroke?: string }) {
  const idRef = useRef<string | undefined>(undefined);
  if (!idRef.current) idRef.current = `eg${_gid++}`;
  const id = idRef.current;
  return (
    <View style={{ height, backgroundColor: theme.primaryTint }}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 130" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
            <Stop offset="1" stopColor={stroke} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Polygon points={`0,130 ${PTS} 390,130`} fill={`url(#${id})`} />
        <Polyline points={PTS} fill="none" stroke={stroke} strokeWidth={2.4} strokeLinejoin="round" />
        <Circle cx={165} cy={32} r={3.5} fill="#EA580C" />
        <Circle cx={235} cy={20} r={3.5} fill="#EA580C" />
      </Svg>
    </View>
  );
}
