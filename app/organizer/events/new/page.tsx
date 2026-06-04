import { EventForm } from "@/components/organizer/event-form";

export default function NewOrganizerEventPage() {
  return (
    <main className="py-8">
      <h1 className="text-2xl font-bold">New event</h1>
      <p className="mt-2 text-sm text-neutral-600">Creates a draft event for your review.</p>
      <EventForm mode="create" />
    </main>
  );
}
