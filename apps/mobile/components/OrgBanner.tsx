import { View } from "react-native";
import Svg, { Rect, Polygon, Polyline } from "react-native-svg";

// Dark-green ridge banner used on the org page header (matches the design's orgBannerSvg).
export function OrgBanner({ height }: { height: number }) {
  return (
    <View style={{ height, backgroundColor: "#0F2A20", overflow: "hidden" }}>
      <Svg width="100%" height="100%" viewBox="0 0 390 150" preserveAspectRatio="none">
        <Rect width={390} height={150} fill="#0F2A20" />
        <Polygon points="0,150 0,96 90,44 180,100 270,54 340,92 390,66 390,150" fill="#153A2C" />
        <Polyline points="0,100 90,50 180,104 270,58 340,96 390,70" fill="none" stroke="#159A55" strokeWidth={2} strokeOpacity={0.6} />
      </Svg>
    </View>
  );
}
