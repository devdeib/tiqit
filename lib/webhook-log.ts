import "server-only";

import { createHash } from "crypto";
import { logger } from "@/lib/logger";

export type WebhookLogInput = {
  requestId: string;
  providerEventId?: string;
  providerPaymentId?: string;
  outcome: "received" | "verified" | "rejected" | "processed" | "duplicate" | "error";
  statusCode?: number;
  durationMs?: number;
  errorCode?: string;
  bodyBytes?: number;
};

export function logWebhookEvent(input: WebhookLogInput): void {
  logger.info("payment_webhook", {
    ...input,
    bodyHash: input.bodyBytes
      ? createHash("sha256").update(String(input.bodyBytes)).digest("hex").slice(0, 16)
      : undefined,
  });
}
