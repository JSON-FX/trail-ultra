// getdesign `apple` structure with the Race Pace trail-green accent.
// Source: the "Race Pace App" design handoff (docs/design/...). SF Pro, clean
// white/parchment surfaces, hairline dividers, pill CTAs — accent green #159A55.
const palette = {
  primary: "#159A55",       // trail green — buttons, links, prices, selected
  primaryFocus: "#0F7A42",  // pressed / darker green
  primaryDark: "#0F7A42",   // "Paid" text, "present QR" label
  primaryTint: "#EAF3EE",   // green tint surface (hero bg, active row, chips)
  forest: "#0F2A20",        // dark green (ticket pass, profile/org banner)
  onPrimary: "#ffffff",
  ink: "#1D1D1F",
  inkMuted: "#7A7A7A",
  inkSubtle: "#8A8A8E",     // group headers, inactive tab labels
  inkFaint: "#CCCCCC",      // placeholders, chevrons
  canvas: "#ffffff",
  parchment: "#F5F5F7",
  pearl: "#fafafc",
  hairline: "#E0E0E0",
  divider: "#EFEFF1",       // light row separators
  // status language — fg / tint bg
  danger: "#FF3B30", dangerTint: "#FDECEA",   // cancelled / destructive
  amber: "#B45309", amberTint: "#FBEFE3",     // almost full / offline
  info: "#0066CC", infoTint: "#E8F0FB",       // rescheduled
  paid: "#0F7A42", paidTint: "#EAF3EE",       // paid
};

export const theme = {
  ...palette,
  radius: { sm: 8, md: 11, card: 14, lg: 18, xl: 22, pill: 9999 },
  space: { xxs: 4, xs: 8, sm: 12, md: 17, lg: 24, xl: 32 },
  // Legacy alias names used by earlier screens → remapped onto the green palette.
  pine: palette.primary,
  inkSoft: palette.inkMuted,
  line: palette.hairline,
  stop: palette.danger,
  paper: palette.parchment,
};
