import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';

// reanimated 4 does not initialize in Expo Go (SDK 57): `createAnimatedComponent`
// is undefined at module-eval time and crashes on import ("undefined is not a
// function"), taking down any screen that renders an RNR select/dialog. The
// animation here is purely cosmetic (entrance/exit fades), so we render plain RN
// views and drop it. `entering`/`exiting` (reanimated layout animations) are
// accepted for API compatibility but ignored. To restore animations, run a
// custom dev build (where reanimated 4 works) and revert this file to the
// reanimated version.
type Props = Record<string, unknown> & {
  as?: 'View' | 'Pressable';
  children?: React.ReactNode;
  entering?: unknown;
  exiting?: unknown;
};

function NativeOnlyAnimatedView({ as, entering: _entering, exiting: _exiting, ...rest }: Props) {
  if (Platform.OS === 'web') {
    return <>{(rest as { children?: React.ReactNode }).children}</>;
  }
  if (as === 'Pressable') {
    return <Pressable {...(rest as React.ComponentProps<typeof Pressable>)} />;
  }
  return <View {...(rest as React.ComponentProps<typeof View>)} />;
}

export { NativeOnlyAnimatedView };
