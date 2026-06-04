import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { assertWebhookReadyForDeployment } from "@/lib/deployment";
import { AppError } from "@/lib/errors";
import { logWebhookEvent } from "@/lib/webhook-log";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  isShamCashWebhooksConfigured,
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
  const started = Date.now();
  return withApiHandler(
    async (ctx) => {
      if (!isShamCashWebhooksConfigured()) {
        throw new AppError(
          "Sham Cash webhooks are not enabled (provider is API-key-only). Payment confirmation uses provider API polling instead.",
          { code: "CONFIG", status: 503, expose: true },
        );
      }

      assertWebhookReadyForDeployment();

      const rawBody = await request.text();
      logWebhookEvent({
        requestId: ctx.requestId,
        outcome: "received",
        bodyBytes: rawBody.length,
      });

      const signature = request.headers.get("x-sham-cash-signature");

      if (!verifyShamCashWebhookSignature(rawBody, signature)) {
        logWebhookEvent({
          requestId: ctx.requestId,
          outcome: "rejected",
          durationMs: Date.now() - started,
          errorCode: "invalid_signature",
        });
        throw new AppError("Invalid webhook signature", {
          code: "UNAUTHORIZED",
          status: 401,
          expose: true,
        });
      }

      logWebhookEvent({ requestId: ctx.requestId, outcome: "verified" });

      let webhookInput;
      try {
        webhookInput = parseShamCashWebhookPayload(rawBody);
      } catch {
        logWebhookEvent({
          requestId: ctx.requestId,
          outcome: "rejected",
          durationMs: Date.now() - started,
          errorCode: "invalid_json",
        });
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

      logWebhookEvent({
        requestId: ctx.requestId,
        outcome: result.alreadyProcessed ? "duplicate" : "processed",
        providerEventId: webhookInput.providerEventId,
        providerPaymentId: webhookInput.providerPaymentId,
        durationMs: Date.now() - started,
      });

      return NextResponse.json({ received: true, ...result });
    },
    {
      request,
      route: "POST /api/webhooks/sham-cash",
      rateLimit: RATE_LIMITS.webhook,
      logClientErrors: true,
    },
  );
}
