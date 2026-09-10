const DEFAULT_THEME = {
  accent: "#F43F5E",
  fg: "#0E0F13",
  bg: "#FFFFFF",
  muted: "#9AA0AA",
  radius: 10,
  fontFamily: "Inter"
};
function buildKit(theme) {
  const t = { ...DEFAULT_THEME, ...theme };
  const R = t.radius;
  const specs = [
    // Buttons
    {
      name: "Buttons/Primary",
      w: 140,
      h: 44,
      fill: t.accent,
      radius: R,
      pad: 16,
      text: { value: "Button", color: "#FFFFFF", size: 15, weight: "Bold", align: "CENTER" }
    },
    {
      name: "Buttons/Secondary",
      w: 140,
      h: 44,
      fill: t.bg,
      stroke: t.muted,
      strokeW: 1,
      radius: R,
      pad: 16,
      text: { value: "Button", color: t.fg, size: 15, weight: "Medium", align: "CENTER" }
    },
    {
      name: "Buttons/Ghost",
      w: 140,
      h: 44,
      fill: "transparent",
      radius: R,
      pad: 16,
      text: { value: "Button", color: t.accent, size: 15, weight: "Medium", align: "CENTER" }
    },
    // Inputs
    {
      name: "Inputs/Text Field",
      w: 280,
      h: 48,
      fill: t.bg,
      stroke: t.muted,
      strokeW: 1,
      radius: R,
      pad: 14,
      text: { value: "Placeholder", color: t.muted, size: 15, weight: "Regular" }
    },
    // Badge / Chip
    {
      name: "Badge/Default",
      w: 72,
      h: 26,
      fill: hexA(t.accent, 0.15),
      radius: 999,
      pad: 10,
      text: { value: "New", color: t.accent, size: 12, weight: "SemiBold", align: "CENTER" }
    },
    {
      name: "Chip/Filter",
      w: 88,
      h: 32,
      fill: t.bg,
      stroke: t.muted,
      strokeW: 1,
      radius: 999,
      pad: 12,
      text: { value: "Filter", color: t.fg, size: 13, weight: "Medium", align: "CENTER" }
    },
    // Card
    {
      name: "Cards/Basic",
      w: 320,
      h: 180,
      fill: t.bg,
      stroke: hexA(t.muted, 0.3),
      strokeW: 1,
      radius: R + 4,
      pad: 20,
      text: { value: "Card title", color: t.fg, size: 17, weight: "Bold" }
    },
    // Avatar
    {
      name: "Avatar/Circle",
      w: 48,
      h: 48,
      fill: hexA(t.accent, 0.2),
      radius: 999,
      text: { value: "AS", color: t.accent, size: 16, weight: "Bold", align: "CENTER" }
    },
    // Toggle track
    { name: "Controls/Toggle", w: 48, h: 28, fill: t.accent, radius: 999 },
    // Tag
    {
      name: "Tag/Neutral",
      w: 64,
      h: 24,
      fill: hexA(t.muted, 0.15),
      radius: 6,
      pad: 8,
      text: { value: "Tag", color: t.fg, size: 12, weight: "Medium", align: "CENTER" }
    }
  ];
  return specs;
}
function typeScale(base = 16) {
  return [
    { name: "Display", size: Math.round(base * 3), weight: "Bold" },
    { name: "H1", size: Math.round(base * 2), weight: "Bold" },
    { name: "H2", size: Math.round(base * 1.5), weight: "SemiBold" },
    { name: "H3", size: Math.round(base * 1.25), weight: "SemiBold" },
    { name: "Body", size: base, weight: "Regular" },
    { name: "Small", size: Math.round(base * 0.875), weight: "Regular" },
    { name: "Caption", size: Math.round(base * 0.75), weight: "Medium" }
  ];
}
function colorRoles(theme) {
  const t = { ...DEFAULT_THEME, ...theme };
  return [
    { name: "Brand/Accent", hex: t.accent },
    { name: "Text/Primary", hex: t.fg },
    { name: "Text/Muted", hex: t.muted },
    { name: "Surface/Background", hex: t.bg },
    { name: "Border/Subtle", hex: t.muted }
  ];
}
function hexA(hex, a) {
  const h = hex.replace("#", "");
  const aa = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
  return `#${h}${aa}`.toUpperCase();
}
export {
  DEFAULT_THEME,
  buildKit,
  colorRoles,
  hexA,
  typeScale
};
