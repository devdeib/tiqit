import { jsonOk, withStaffReadHandler } from "@/lib/api/staff-handler";
import { listStaffAssignedEvents } from "@/services/staff/events.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withStaffReadHandler(
    async (_ctx, staff) => {
      const events = await listStaffAssignedEvents(staff);
      return jsonOk({ events });
    },
    { request, route: "GET /api/staff/events" },
  );
}
