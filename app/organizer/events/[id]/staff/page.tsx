import Link from "next/link";
import { StaffManager } from "@/components/organizer/staff-manager";
import { getOrganizerContext } from "@/lib/organizer-auth";
import { getOrganizerEvent } from "@/services/organizer/events.service";
import {
  listEventStaffAssignments,
  listStaffOptions,
} from "@/services/organizer/staff.service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function OrganizerStaffPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getOrganizerContext();
  if (!ctx) return null;

  const [event, assignments, staffOptions] = await Promise.all([
    getOrganizerEvent(ctx, id),
    listEventStaffAssignments(ctx, id),
    listStaffOptions(ctx),
  ]);

  return (
    <main className="py-8">
      <Link href={`/organizer/events/${id}`} className="text-sm text-neutral-600 underline">
        ← Back to event
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Staff</h1>
      <p className="mt-1 text-neutral-600">{event.title}</p>
      <StaffManager
        eventId={id}
        initialAssignments={assignments}
        staffOptions={staffOptions}
      />
    </main>
  );
}
