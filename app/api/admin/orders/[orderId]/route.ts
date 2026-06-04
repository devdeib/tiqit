import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { assertAdminApiKey } from "@/lib/admin-auth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { inspectOrder } from "@/services/admin-emergency.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ orderId: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApiHandler(
    async () => {
      assertAdminApiKey(request);
      const { orderId } = await params;
      const inspection = await inspectOrder(orderId);
      return jsonOk({ inspection });
    },
    { request, route: "GET /api/admin/orders/[orderId]", rateLimit: RATE_LIMITS.admin },
  );
}
