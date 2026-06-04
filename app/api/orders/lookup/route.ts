import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { orderLookupSchema } from "@/lib/validators/schemas";
import { getOrderConfirmation } from "@/services/fulfillment.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const body = await request.json().catch(() => null);
    const parsed = orderLookupSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("Invalid request body", {
        code: "VALIDATION_ERROR",
        status: 400,
        expose: true,
        details: { issues: parsed.error.flatten() },
      });
    }

    const order = await getOrderConfirmation(parsed.data.orderId, parsed.data.phone);
    return jsonOk({ order });
  });
}
