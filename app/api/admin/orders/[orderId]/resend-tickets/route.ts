import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { assertAdminApiKey } from "@/lib/admin-auth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { resendTicketsForOrder } from "@/services/admin-emergency.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, { params }: Params) {
  return withApiHandler(
    async () => {
      assertAdminApiKey(request);
      const { orderId } = await params;
      const result = await resendTicketsForOrder(orderId);
      return jsonOk({ result });
    },
    { request, route: "POST /api/admin/orders/[orderId]/resend-tickets", rateLimit: RATE_LIMITS.admin },
  );
}
