import { View, Text } from "react-native";
import Svg, { Rect, Circle, Path } from "react-native-svg";

// Recognizable brand marks for the payment-method picker, drawn as inline SVG/text so they need
// no bundled assets and stay crisp at any size. These are clean recreations of each brand's mark,
// not the exact official artwork. To use a provider's official logo instead, save its file into
// assets/ (e.g. assets/gcash.png) and render it here with:  <Image source={require("../../assets/gcash.png")} style={{ width, height }} />

export function VisaMark({ height = 15 }: { height?: number }) {
  return <Text style={{ fontStyle: "italic", fontWeight: "800", fontSize: height, color: "#1434CB", letterSpacing: -0.5 }}>VISA</Text>;
}

export function MastercardMark({ height = 16 }: { height?: number }) {
  const width = (height * 40) / 24;
  return (
    <Svg width={width} height={height} viewBox="0 0 40 24" accessibilityLabel="Mastercard">
      <Circle cx={16} cy={12} r={11} fill="#EB001B" />
      <Circle cx={26} cy={12} r={11} fill="#F79E1B" fillOpacity={0.9} />
    </Svg>
  );
}

/** GCash — blue tile with the white "G" and its signal waves. */
export function GcashMark({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="GCash">
      <Rect width={24} height={24} rx={7} fill="#1E88FF" />
      <Path d="M15 9.2 a4.5 4.5 0 1 0 0 5.6" fill="none" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M15 12 H11.2" fill="none" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M16.7 9.9 a3.3 3.3 0 0 1 0 4.2" fill="none" stroke="#AFCDFF" strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M18.2 8.7 a5 5 0 0 1 0 6.6" fill="none" stroke="#AFCDFF" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Maya — the lowercase wordmark in its spring-green, shown on a dark lockup for contrast on light rows. */
export function MayaMark() {
  return (
    <View style={{ backgroundColor: "#141414", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 }}>
      <Text style={{ color: "#1AE896", fontWeight: "800", fontSize: 13, letterSpacing: -0.3 }}>maya</Text>
    </View>
  );
}

/** Logo(s) for a PayMongo method key, sized for the method rows. */
export function MethodLogo({ methodKey }: { methodKey: string }) {
  if (methodKey === "card") {
    return (
      <View className="flex-row items-center gap-[7px]">
        <VisaMark height={15} />
        <MastercardMark height={16} />
      </View>
    );
  }
  if (methodKey === "gcash") return <GcashMark size={22} />;
  if (methodKey === "maya") return <MayaMark />;
  return null;
}
