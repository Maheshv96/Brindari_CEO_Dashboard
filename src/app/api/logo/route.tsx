import { ImageResponse } from "next/og";

export const runtime = "edge";

// Renders the exact logo-icon.svg as a PNG (160×160, 2× of the 80×80 viewBox).
// Ellipse positions and rotations match logo-icon.svg exactly:
//   translate(8,8) → 4 ellipses cx/cy scaled ×2, rx=12 ry=18, same rotations.
// Download at /api/logo → save as logo-icon.png → upload to public_html/assets/

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: 160, height: 160 }}>

        {/* Ellipse 1 — far left, dark teal, rotate -30 (cx=22+8=30 cy=28+8=36 ×2 → 60,72) */}
        <div style={{
          position: "absolute",
          left: 48, top: 54,       // center (60,72) minus half-dims (12,18)
          width: 24, height: 36,
          background: "#0F6E56",
          borderRadius: "50%",
          transform: "rotate(-30deg)",
        }} />

        {/* Ellipse 2 — centre-left, dark teal, rotate -15 (cx=32+8=40 cy=20+8=28 ×2 → 80,56) */}
        <div style={{
          position: "absolute",
          left: 68, top: 38,
          width: 24, height: 36,
          background: "#0F6E56",
          borderRadius: "50%",
          transform: "rotate(-15deg)",
        }} />

        {/* Ellipse 3 — centre-right, sage, rotate +15 (cx=44+8=52 cy=20+8=28 ×2 → 104,56) */}
        <div style={{
          position: "absolute",
          left: 92, top: 38,
          width: 24, height: 36,
          background: "#7BA88A",
          borderRadius: "50%",
          transform: "rotate(15deg)",
        }} />

        {/* Ellipse 4 — far right, sage, rotate +30 (cx=54+8=62 cy=28+8=36 ×2 → 124,72) */}
        <div style={{
          position: "absolute",
          left: 112, top: 54,
          width: 24, height: 36,
          background: "#7BA88A",
          borderRadius: "50%",
          transform: "rotate(30deg)",
        }} />

        {/* Stem — M38+8=46 28+8=36 L 46 72, ×2 → x=92 y=72→144, width=6 */}
        <div style={{
          position: "absolute",
          left: 89, top: 72,
          width: 6, height: 72,
          background: "#0F6E56",
          borderRadius: 3,
        }} />

      </div>
    ),
    { width: 160, height: 160 }
  );
}
