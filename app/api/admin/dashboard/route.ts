import { jsonOk, withAdminReadHandler } from "@/lib/api/admin-handler";
import { getAdminDashboardStats } from "@/services/admin/events.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAdminReadHandler(
    async (_ctx, admin) => {
      const stats = await getAdminDashboardStats(admin);
      return jsonOk({ stats });
    },
    { request, route: "GET /api/admin/dashboard" },
  );
}
