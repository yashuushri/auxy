import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b12",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
          <circle cx="8" cy="18" r="4" stroke="#ffffff" strokeWidth="2" />
          <path d="M12 18V2l7 4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size
  );
}
