import { notFound } from "next/navigation";
import { getPublicEvent } from "@/services/events.service";
import { PurchaseForm } from "@/components/checkout/purchase-form";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EventPage({ params }: Props) {
  const { id } = await params;

  try {
    const event = await getPublicEvent(id);
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="mt-2 text-neutral-600">{event.venue}</p>
        <p className="mt-1 text-sm text-neutral-500">
          {new Date(event.eventDate).toLocaleString()}
        </p>
        {event.description && (
          <p className="mt-4 text-neutral-700">{event.description}</p>
        )}
        <PurchaseForm event={event} />
      </main>
    );
  } catch (err) {
    if (isAppError(err) && err.status === 404) notFound();
    throw err;
  }
}
