module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // react-native-reanimated's worklet transform (v4 re-exports
    // react-native-worklets/plugin). REQUIRED and MUST be last — without it
    // reanimated's runtime is broken (Animated.createAnimatedComponent is
    // undefined), crashing any RNR primitive that renders it (select/dialog/
    // progress via native-only-animated-view). babel-preset-expo does not add
    // it automatically. `react-native-reanimated/plugin` is used (not the bare
    // `react-native-worklets/plugin`) because only the former resolves under pnpm.
    plugins: ["react-native-reanimated/plugin"],
  };
};
