import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { verifyPaymentSchema } from "@/lib/validators/schemas";
import { verifyCheckoutPayment } from "@/services/checkout.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, { params }: Params) {
  return withApiHandler(
    async () => {
      const { orderId } = await params;
      const body = await request.json().catch(() => null);
      const parsed = verifyPaymentSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("phone is required in request body (E.164)", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: { issues: parsed.error.flatten() },
        });
      }

      const result = await verifyCheckoutPayment(orderId, parsed.data.phone);
      return jsonOk({ result });
    },
    { request, route: "POST /api/checkout/[orderId]/verify-payment", rateLimit: RATE_LIMITS.guestWrite },
  );
}
