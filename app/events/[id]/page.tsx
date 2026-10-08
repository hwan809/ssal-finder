import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvent } from "@/lib/events";
import { formatDateKst } from "@/lib/calendar-utils";
import { shareHeadline } from "@/lib/event-display";
import { EventDetail } from "@/components/events/event-detail";
import { S } from "@/lib/strings";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return {};
  const headline = shareHeadline(event);
  const description = [formatDateKst(event.start_at), event.title, event.location]
    .filter(Boolean)
    .join(" · ");
  return {
    title: `${event.title} | ${S.APP_SHORT}`,
    description,
    openGraph: { title: headline, description, siteName: S.APP_NAME, type: "website" },
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  return <EventDetail event={event} />;
}
