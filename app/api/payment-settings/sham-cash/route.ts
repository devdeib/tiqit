import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getPublicShamCashPaymentSettings } from "@/services/payment-settings.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiHandler(
    async () => {
      const settings = await getPublicShamCashPaymentSettings();
      return jsonOk({ settings });
    },
    { request, route: "GET /api/payment-settings/sham-cash", rateLimit: RATE_LIMITS.guestRead },
  );
}
