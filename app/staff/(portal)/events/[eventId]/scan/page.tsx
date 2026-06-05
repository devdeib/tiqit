import { ScanConsole } from "@/components/staff/scan-console";
import { getStaffContext, assertStaffAssignedToEvent } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ eventId: string }> };

export default async function StaffScanPage({ params }: Props) {
  const staff = await getStaffContext();
  if (!staff) return null;

  const { eventId } = await params;
  await assertStaffAssignedToEvent(staff, eventId);

  const { data: event } = await staff.supabase
    .from("events")
    .select("title")
    .eq("id", eventId)
    .single();

  return <ScanConsole eventId={eventId} eventTitle={event?.title ?? "Event"} />;
}
