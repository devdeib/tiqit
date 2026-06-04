import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { assertDevPaymentAllowed } from "@/lib/dev-payment";
import { AppError } from "@/lib/errors";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { simulatePaymentSchema } from "@/lib/validators/schemas";
import { simulateMockPayment } from "@/services/fulfillment.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiHandler(
    async () => {
      assertDevPaymentAllowed();

      const body = await request.json().catch(() => null);
      const parsed = simulatePaymentSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid request body", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: { issues: parsed.error.flatten() },
        });
      }

      await simulateMockPayment(parsed.data.orderId, parsed.data.phone);
      return NextResponse.json({ ok: true, orderId: parsed.data.orderId });
    },
    { request, route: "POST /api/dev/simulate-payment", rateLimit: RATE_LIMITS.guestWrite },
  );
}
