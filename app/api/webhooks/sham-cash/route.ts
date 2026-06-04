import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { assertWebhookReadyForDeployment } from "@/lib/deployment";
import { AppError } from "@/lib/errors";
import { isProductionDeploy } from "@/lib/env";
import {
  parseShamCashWebhookPayload,
  verifyShamCashWebhookSignature,
} from "@/services/sham-cash";
import { processPaymentWebhook } from "@/services/fulfillment.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      endpoint: "/api/webhooks/sham-cash",
      methods: ["POST"],
      signatureHeader: "x-sham-cash-signature",
    },
    { status: 405 },
  );
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    if (isProductionDeploy()) {
      assertWebhookReadyForDeployment();
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-sham-cash-signature");

    if (!verifyShamCashWebhookSignature(rawBody, signature)) {
      throw new AppError("Invalid webhook signature", {
        code: "UNAUTHORIZED",
        status: 401,
        expose: true,
      });
    }

    let webhookInput;
    try {
      webhookInput = parseShamCashWebhookPayload(rawBody);
    } catch {
      throw new AppError("Invalid webhook JSON payload", {
        code: "VALIDATION_ERROR",
        status: 400,
        expose: true,
      });
    }

    const result = await processPaymentWebhook(
      {
        providerEventId: webhookInput.providerEventId,
        providerPaymentId: webhookInput.providerPaymentId,
        orderId: webhookInput.orderId,
        status: webhookInput.status,
        amount: webhookInput.amount,
      },
      rawBody,
    );

    return NextResponse.json({ received: true, ...result });
  });
}
