import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getEvent } from "@/lib/events";
import { FOOD_ICONS } from "@/lib/colors";
import { formatDateKst, shortFoodName } from "@/lib/calendar-utils";
import { S } from "@/lib/strings";

export const alt = S.APP_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// satori는 woff2를 못 읽어서 정적 otf를 따로 둔다
const fontBlack = readFile(join(process.cwd(), "assets/fonts/WantedSans-Black.otf"));
const fontBold = readFile(join(process.cwd(), "assets/fonts/WantedSans-Bold.otf"));

const oneLine = { display: "block", lineClamp: 1 } as const;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#fff",
          color: "#000",
          fontFamily: "Wanted Sans",
          borderTop: "14px solid #e8390e",
        }}
      >
        {event ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 88, fontWeight: 900, letterSpacing: "-0.03em" }}>
              <span style={{ marginRight: 24 }}>{FOOD_ICONS[event.food_type]}</span>
              {S.SHARE_HEADLINE(shortFoodName(event.food_note, event.food_type))}
            </div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 48, fontWeight: 700, color: "#000" }}>
              {formatDateKst(event.start_at)}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 88, fontWeight: 900 }}>{S.APP_NAME}</div>
        )}

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 860, fontSize: 30, fontWeight: 700 }}>
            {event && <div style={{ ...oneLine, color: "#444" }}>{event.title}</div>}
            {event?.location && <div style={{ ...oneLine, marginTop: 8, color: "#999" }}>{event.location}</div>}
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 900, color: "#e8390e" }}>{S.APP_SHORT}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Wanted Sans", data: await fontBold, weight: 700, style: "normal" },
        { name: "Wanted Sans", data: await fontBlack, weight: 900, style: "normal" },
      ],
    },
  );
}
