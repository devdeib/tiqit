import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createCheckoutSchema } from "@/lib/validators/schemas";
import { createCheckout } from "@/services/checkout.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiHandler(
    async () => {
      const body = await request.json().catch(() => null);
      const parsed = createCheckoutSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid request body", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: { issues: parsed.error.flatten() },
        });
      }

      const checkout = await createCheckout(parsed.data);
      return jsonOk({ checkout }, 201);
    },
    { request, route: "POST /api/checkout", rateLimit: RATE_LIMITS.guestWrite },
  );
}
