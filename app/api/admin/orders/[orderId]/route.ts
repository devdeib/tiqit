import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { jsonOk as portalJsonOk, withAdminReadHandler } from "@/lib/api/admin-handler";
import { assertAdminApiKey } from "@/lib/admin-auth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { inspectOrder } from "@/services/admin-emergency.service";
import { inspectAdminOrder } from "@/services/admin/orders.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ orderId: string }> };

const ADMIN_API_KEY_HEADER = "x-admin-api-key";

export async function GET(request: Request, { params }: Params) {
  const { orderId } = await params;

  if (request.headers.get(ADMIN_API_KEY_HEADER)) {
    return withApiHandler(
      async () => {
        assertAdminApiKey(request);
        const inspection = await inspectOrder(orderId);
        return jsonOk({ inspection });
      },
      { request, route: "GET /api/admin/orders/[orderId]", rateLimit: RATE_LIMITS.admin },
    );
  }

  return withAdminReadHandler(
    async (_ctx, admin) => {
      const inspection = await inspectAdminOrder(admin, orderId);
      return portalJsonOk({ inspection });
    },
    { request, route: "GET /api/admin/orders/[orderId]" },
  );
}
