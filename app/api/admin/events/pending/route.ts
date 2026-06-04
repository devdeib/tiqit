import { jsonOk, withAdminReadHandler } from "@/lib/api/admin-handler";
import { listPendingEvents } from "@/services/admin/events.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAdminReadHandler(
    async (_ctx, admin) => {
      const events = await listPendingEvents(admin);
      return jsonOk({ events });
    },
    { request, route: "GET /api/admin/events/pending" },
  );
}
