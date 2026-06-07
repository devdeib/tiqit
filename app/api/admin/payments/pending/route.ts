import { jsonOk, withAdminReadHandler } from "@/lib/api/admin-handler";
import { listPendingManualPayments } from "@/services/admin/payments.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAdminReadHandler(
    async (_ctx, admin) => {
      const payments = await listPendingManualPayments(admin);
      return jsonOk({ payments });
    },
    { request, route: "GET /api/admin/payments/pending" },
  );
}
