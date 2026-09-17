import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 20,
          background: "linear-gradient(135deg, #0ea5e9, #3b82f6)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          borderRadius: "8px",
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
        }}
      >
        SF
      </div>
    ),
    {
      ...size,
    }
  );
}
