import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #E8590C, #F97316)",
          borderRadius: 14,
          fontSize: 38,
        }}
      >
        🍚
      </div>
    ),
    { ...size },
  );
}
