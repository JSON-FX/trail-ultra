// Dynamic Expo config. The static config lives in app.json and is passed in as `config`.
//
// Push notifications are gated behind EXPO_PUBLIC_ENABLE_PUSH. The expo-notifications config
// plugin adds the iOS Push Notifications capability (the `aps-environment` entitlement), which
// a free/personal Apple Developer team cannot sign — so local/dev device builds must omit it.
//
//   - Default (unset):        no push entitlement -> device builds sign on a free Apple team.
//   - EXPO_PUBLIC_ENABLE_PUSH=1: push entitlement added -> production / EAS builds (paid team + APNs).
//
// The expo-notifications native module still autolinks from package.json either way, so the
// in-app notification inbox works in both modes; only the entitlement is conditional.
module.exports = ({ config }) => {
  const enablePush = process.env.EXPO_PUBLIC_ENABLE_PUSH === "1";
  const plugins = [...(config.plugins ?? [])];
  if (enablePush) {
    plugins.push(["expo-notifications", { color: "#159A55" }]);
  }
  return { ...config, plugins };
};
