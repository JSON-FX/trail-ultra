// Manual jest mock. react-native-reanimated reaches into a native JSI
// worklets module at import time; that module doesn't exist under Jest, so
// importing the real package crashes on load (see jest.resolver.js for the
// related react-native-worklets ".native.ts" resolution fix). The package
// ships its own "react-native-reanimated/mock" jest helper, but on the
// version combo installed here (reanimated 4.5.0 + worklets 0.11.1, both
// pulled in transitively by Expo SDK 57 — reanimated's own peerDependencies
// ask for worklets 0.10.x) that helper still imports the real, crashing
// entry point and additionally trips reanimated's own worklets-version
// compatibility assertion. Downgrading worklets to satisfy that assertion
// risks destabilizing the native build the app actually ships, which is out
// of scope here — so instead this stubs just the surface area the RNR
// select/dialog/progress primitives use. Animated Views behave like plain
// Views (no real animation runs under Jest), FadeIn/FadeOut are inert, and
// interpolate()/useDerivedValue()/useAnimatedStyle() do real, synchronous
// (non-worklet) math so Progress's indicator still computes a sane style.
const React = require("react");
const { View } = require("react-native");

function stripAnimationProps(props) {
  const { entering, exiting, layout, ...rest } = props;
  return rest;
}

const AnimatedView = React.forwardRef(function AnimatedView(props, ref) {
  return React.createElement(View, { ref, ...stripAnimationProps(props) });
});

function createAnimatedComponent(Component) {
  const Animated = React.forwardRef(function AnimatedComponent(props, ref) {
    return React.createElement(Component, { ref, ...stripAnimationProps(props) });
  });
  Animated.displayName = `Animated(${Component.displayName || Component.name || "Component"})`;
  return Animated;
}

// entering/exiting animation config objects are chainable builders in the
// real API (FadeIn.duration(200).delay(100)); every method just returns
// `this` since NativeOnlyAnimatedView never runs the real animation engine.
class ChainableAnimationMock {
  duration() { return this; }
  delay() { return this; }
  springify() { return this; }
  damping() { return this; }
  stiffness() { return this; }
  mass() { return this; }
  withInitialValues() { return this; }
  withCallback() { return this; }
  randomDelay() { return this; }
  reduceMotion() { return this; }
}

const ReduceMotion = { System: "system", Always: "always", Never: "never" };
const Extrapolation = { EXTEND: "extend", CLAMP: "clamp", IDENTITY: "identity" };

function clamp(value, lo, hi) {
  return Math.min(Math.max(value, lo), hi);
}

// Minimal linear interpolation — enough for Progress's single-segment usage
// (`interpolate(value, [0, 100], [1, 100], Extrapolation.CLAMP)`) without
// pulling in the real worklet-based implementation.
function interpolate(value, input, output, extrapolate) {
  const mode = typeof extrapolate === "string" ? extrapolate : Extrapolation.EXTEND;
  let i = 0;
  while (i < input.length - 2 && value > input[i + 1]) i++;
  const [x0, x1] = [input[i], input[i + 1]];
  const [y0, y1] = [output[i], output[i + 1]];
  const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
  let result = y0 + t * (y1 - y0);
  if (mode === Extrapolation.CLAMP) {
    const lo = Math.min(output[0], output[output.length - 1]);
    const hi = Math.max(output[0], output[output.length - 1]);
    result = clamp(result, lo, hi);
  }
  return result;
}

// Real shared values re-run worklets on the UI thread when `.value` changes;
// under Jest there's no worklet runtime, so these just recompute inline on
// every call/render and expose the same `{ value }` shape callers read.
function useDerivedValue(fn) {
  const ref = React.useRef({ value: undefined });
  ref.current.value = fn();
  return ref.current;
}

function useAnimatedStyle(fn) {
  return fn();
}

function useSharedValue(initial) {
  const ref = React.useRef({ value: initial });
  return ref.current;
}

const withSpring = (toValue) => toValue;
const withTiming = (toValue) => toValue;
const withDecay = (toValue) => toValue;
const runOnJS = (fn) => fn;
const runOnUI = (fn) => fn;

const Animated = {
  View: AnimatedView,
  Text: AnimatedView,
  ScrollView: AnimatedView,
  Image: AnimatedView,
  createAnimatedComponent,
};

module.exports = {
  __esModule: true,
  default: Animated,
  createAnimatedComponent,
  FadeIn: new ChainableAnimationMock(),
  FadeOut: new ChainableAnimationMock(),
  ReduceMotion,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  withDecay,
  runOnJS,
  runOnUI,
};
