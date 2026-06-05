import { jsonOk, withStaffReadHandler } from "@/lib/api/staff-handler";
import { getStaffEventStats } from "@/services/staff/scan.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(request: Request, { params }: Params) {
  return withStaffReadHandler(
    async (_ctx, staff) => {
      const { eventId } = await params;
      const stats = await getStaffEventStats(staff, eventId);
      return jsonOk({ stats });
    },
    { request, route: "GET /api/staff/events/[eventId]/stats" },
  );
}
