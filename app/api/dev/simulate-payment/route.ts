import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { isProductionDeploy } from "@/lib/env";
import { simulatePaymentSchema } from "@/lib/validators/schemas";
import { simulateMockPayment } from "@/services/fulfillment.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (isProductionDeploy() && process.env.ALLOW_DEV_PAYMENT !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return withApiHandler(async () => {
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
  });
}
