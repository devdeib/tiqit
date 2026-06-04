import { jsonOk, withAdminReadHandler } from "@/lib/api/admin-handler";
import { listRecentAuditLogs, listStuckPayments } from "@/services/admin/webhooks.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAdminReadHandler(
    async (_ctx, admin) => {
      const [stuckPayments, recentAudit] = await Promise.all([
        listStuckPayments(admin),
        listRecentAuditLogs(admin, 20),
      ]);
      return jsonOk({ stuckPayments, recentAudit });
    },
    { request, route: "GET /api/admin/webhooks" },
  );
}
