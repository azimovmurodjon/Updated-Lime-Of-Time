/** @type {const} */
const themeColors = {
  // Primary: deep sage green — main brand color
  primary:         { light: '#4A7C59', dark: '#6AAF80' },
  // Accent: lime green — highlights, badges, active states
  accent:          { light: '#8FBF6A', dark: '#A8D485' },
  // Tint: alias for primary (used by tab bar, links)
  tint:            { light: '#4A7C59', dark: '#6AAF80' },
  // Background: off-white / deep navy
  background:      { light: '#F8FAF7', dark: '#0D1B2A' },
  // Surface: cards, sheets
  surface:         { light: '#FFFFFF', dark: '#152233' },
  // Surface elevated: modals, popovers
  surfaceElevated: { light: '#FFFFFF', dark: '#1C2E42' },
  // Surface alt: subtle tinted backgrounds
  surfaceAlt:      { light: '#EEF5E8', dark: '#162030' },
  // Foreground: primary text
  foreground:      { light: '#111827', dark: '#EEF2F0' },
  // Muted: secondary text, placeholders
  muted:           { light: '#6B7280', dark: '#8FA3A0' },
  // Border: dividers, input borders
  border:          { light: '#E5EDE8', dark: '#243547' },
  // Semantic
  success:         { light: '#22C55E', dark: '#4ADE80' },
  warning:         { light: '#F59E0B', dark: '#FBBF24' },
  error:           { light: '#EF4444', dark: '#F87171' },
};

module.exports = { themeColors };
