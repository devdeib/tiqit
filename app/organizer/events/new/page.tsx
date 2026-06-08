import { EventForm } from "@/components/organizer/event-form";

export default function NewOrganizerEventPage() {
  return (
    <main style={{ paddingTop:"40px", maxWidth:"640px" }}>
      <h1 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"6px" }}>New event</h1>
      <p style={{ fontSize:"13px", color:"var(--tq-muted)", marginBottom:"32px" }}>Creates a draft event for your review before submitting for approval.</p>
      <EventForm mode="create" />
    </main>
  );
}
