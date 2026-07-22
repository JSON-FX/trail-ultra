// @testing-library/react-native@13+ registers its Jest matchers (toBeOnTheScreen,
// etc.) as a side effect of importing the package root — the older
// "@testing-library/react-native/extend-expect" subpath no longer exists.
import "@testing-library/react-native";
import { View } from "react-native";

// react-native-reanimated is stubbed via __mocks__/react-native-reanimated.js
// (a manual mock for a node_modules package — Jest applies it automatically,
// see that file for why the package's own "react-native-reanimated/mock"
// jest helper doesn't work here).

// RNR's Select/Dialog primitives (@rn-primitives/select, @rn-primitives/dialog)
// only render their Portal content once they know where the trigger is on
// screen: pressing the trigger calls `triggerRef.current.measure(callback)`
// and waits for the callback to report a layout rect. Under the RN jest
// preset, every <View> (and anything built on it, like Pressable) resolves
// its ref to one shared mock class (see
// @react-native/jest-preset/jest/mocks/View.js), whose `measure` — along
// with `measureInWindow`/`measureLayout`/etc. — is a plain `jest.fn()` that
// never invokes its callback (there's no real layout engine under Jest).
// That leaves `triggerPosition` permanently null, so the Portal never
// mounts and `fireEvent.press(trigger)` silently does nothing observable.
// Patching `measure` on that shared prototype to synchronously report a
// (fake, fixed) layout rect is what makes real fireEvent.press interactions
// against RNR Select/Dialog work end-to-end in tests — trigger press opens
// the portal, item press fires onValueChange, etc. The exact numbers are
// arbitrary; nothing here asserts on real screen geometry.
(View as unknown as { prototype: { measure: (cb: (...args: number[]) => void) => void } }).prototype.measure =
  function measure(callback) {
    callback(0, 0, 120, 40, 0, 0);
  };

// expo-video is a native module (login background video); stub it for Jest so
// screens that import it render. The setup callback runs against a fake player.
jest.mock("expo-video", () => ({
  useVideoPlayer: (_source: unknown, setup?: (p: { loop: boolean; muted: boolean; play: () => void }) => void) => {
    const player = { loop: false, muted: false, play: jest.fn() };
    if (typeof setup === "function") setup(player);
    return player;
  },
  VideoView: () => null,
}));

process.env.EXPO_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:54521";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

// Mock AsyncStorage for Jest before Supabase modules are imported
const AsyncStorageMock = {
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
  multiGet: jest.fn(async () => []),
  multiSet: jest.fn(async () => {}),
  multiRemove: jest.fn(async () => {}),
  clear: jest.fn(async () => {}),
};

jest.doMock("@react-native-async-storage/async-storage", () => AsyncStorageMock, {
  virtual: true,
});
