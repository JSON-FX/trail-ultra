// getdesign `apple` design language — see DESIGN.md.
// Action Blue accent, SF Pro, clean white/parchment surfaces, hairline dividers, no chrome shadows.
const palette = {
  primary: "#0066cc",
  primaryFocus: "#0071e3",
  onPrimary: "#ffffff",
  ink: "#1d1d1f",
  inkMuted: "#7a7a7a",
  inkFaint: "#cccccc",
  canvas: "#ffffff",
  parchment: "#f5f5f7",
  pearl: "#fafafc",
  hairline: "#e0e0e0",
  divider: "#f0f0f0",
  danger: "#ff3b30", // iOS system red — DESIGN.md's marketing palette defines no error color
};

export const theme = {
  ...palette,
  radius: { sm: 8, md: 11, lg: 18, pill: 9999 },
  space: { xxs: 4, xs: 8, sm: 12, md: 17, lg: 24, xl: 32 },
  // Legacy alias names used by earlier screens → remapped onto the apple palette.
  pine: palette.primary,
  inkSoft: palette.inkMuted,
  line: palette.hairline,
  stop: palette.danger,
  paper: palette.parchment,
};
