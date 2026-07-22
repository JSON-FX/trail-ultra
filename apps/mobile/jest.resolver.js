// Custom Jest resolver — required because jest config only allows one
// `resolver`, and we need the behavior of two different upstream ones:
//
// 1. @react-native/jest-preset's default resolver (jest/resolver.js): the
//    RN haste config resolves `.ios.*`/`.native.*` files preferentially,
//    which would otherwise make react-native's own "exports" field block
//    subpath resolution under Jest (RFC0894 back-compat).
// 2. react-native-worklets' resolver (jest/resolver.js): under that same
//    "prefer .native.*" haste config, react-native-worklets' own internal
//    requires resolve to its *.native.ts entry points, which reach for a
//    real JSI/native binding that doesn't exist under Jest and crash on
//    import (react-native-reanimated depends on react-native-worklets, and
//    the RNR select/dialog primitives pull in react-native-reanimated).
//
// Neither upstream file is reachable via a bare specifier from apps/mobile
// (pnpm doesn't hoist either package here — both are transitive deps), so
// this reimplements both fixups locally instead of requiring them in.
module.exports = (request, options) => {
  const { defaultResolver, packageFilter: originalPackageFilter } = options;

  let resolveOptions = {
    ...options,
    packageFilter: (pkg) => {
      const filtered = originalPackageFilter ? originalPackageFilter(pkg) : pkg;
      if (filtered.name === "react-native") {
        delete filtered.exports;
      }
      return filtered;
    },
  };

  if (options.basedir.includes("react-native-worklets") || request.includes("react-native-worklets")) {
    resolveOptions = {
      ...resolveOptions,
      extensions: (resolveOptions.extensions || []).filter((ext) => !ext.includes("native")),
    };
  }

  return defaultResolver(request, resolveOptions);
};
