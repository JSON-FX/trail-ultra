// @testing-library/react-native@13+ registers its Jest matchers (toBeOnTheScreen,
// etc.) as a side effect of importing the package root — the older
// "@testing-library/react-native/extend-expect" subpath no longer exists.
import "@testing-library/react-native";

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
