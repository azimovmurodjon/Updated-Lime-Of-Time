/**
 * Brand icon SVG components for social login buttons.
 * Google G logo and Microsoft four-square logo — pixel-accurate to official brand guidelines.
 */
import Svg, { Path, Rect, G, ClipPath, Defs } from "react-native-svg";

interface IconProps {
  size?: number;
}

/**
 * Official Google "G" logo in brand colours.
 */
export function GoogleLogo({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Blue right arc */}
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      {/* Green bottom arc */}
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      {/* Yellow bottom-left arc */}
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      {/* Red left arc */}
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
    </Svg>
  );
}

/**
 * Official Microsoft four-square logo in brand colours.
 */
export function MicrosoftLogo({ size = 20 }: IconProps) {
  const sq = size * 0.45; // each square is ~45% of total size
  const gap = size * 0.1; // gap between squares is ~10% of total size
  const offset = (size - (sq * 2 + gap)) / 2; // center the 2x2 grid

  return (
    <Svg width={size} height={size} viewBox="0 0 21 21">
      {/* Top-left: red */}
      <Rect x="0" y="0" width="10" height="10" fill="#F25022" />
      {/* Top-right: green */}
      <Rect x="11" y="0" width="10" height="10" fill="#7FBA00" />
      {/* Bottom-left: blue */}
      <Rect x="0" y="11" width="10" height="10" fill="#00A4EF" />
      {/* Bottom-right: yellow */}
      <Rect x="11" y="11" width="10" height="10" fill="#FFB900" />
    </Svg>
  );
}

/**
 * Apple logo (SF Symbol fallback — uses a simple apple path).
 * Renders in the current text colour (pass `color` prop).
 */
export function AppleLogo({ size = 20, color = "#000" }: IconProps & { color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 814 1000">
      <Path
        fill={color}
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 405.8 15 285.3 15 170.1c0-103.7 33.8-199.5 94.9-271.6 58.1-68.7 143.7-109.3 234.4-109.3 88.8 0 160.9 57.2 215.9 57.2 52.8 0 135.3-60.9 236.1-60.9 37.8 0 139.8 3.2 209.8 117.9zm-166.3-254c-10.3-58.7-37.8-119.3-76.6-162.4-45.5-49.7-107.7-83.5-166.3-83.5-5.8 0-11.6.6-17.4 1.3 1.9 65.3 27.1 129.3 65.3 175.4 41.5 49.7 103.7 84.8 162.4 90.6 10.9 1.3 21.8 1.9 32.6 1.9v-23.3z"
      />
    </Svg>
  );
}
