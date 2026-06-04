import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { verifyShamCashWebhookSignature } from "@/services/sham-cash/client";
import { processPaymentWebhook } from "@/services/fulfillment.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const rawBody = await request.text();
    const signature = request.headers.get("x-sham-cash-signature");

    if (!verifyShamCashWebhookSignature(rawBody, signature)) {
      throw new AppError("Invalid webhook signature", {
        code: "UNAUTHORIZED",
        status: 401,
        expose: true,
      });
    }

    const payload = JSON.parse(rawBody) as {
      event_id?: string;
      payment_id: string;
      order_id?: string;
      status: string;
      amount?: number;
    };

    const result = await processPaymentWebhook(
      {
        providerEventId: payload.event_id ?? payload.payment_id,
        providerPaymentId: payload.payment_id,
        orderId: payload.order_id,
        status: payload.status === "completed" ? "completed" : "failed",
        amount: payload.amount,
      },
      rawBody,
    );

    return NextResponse.json({ received: true, ...result });
  });
}
