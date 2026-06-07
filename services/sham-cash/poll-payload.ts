/**
 * Builds a synthetic webhook-shaped payload from a provider poll result.
 * Used to reuse processPaymentWebhook → fulfill_payment_webhook without webhooks.
 */

export type PollConfirmationPayload = {
  providerEventId: string;
  providerPaymentId: string;
  orderId?: string;
  status: "completed" | "failed";
  amount?: number;
};

export function buildPollEventId(
  providerPaymentId: string,
  status: "completed" | "failed",
): string {
  return `poll:${providerPaymentId}:${status}`;
}

export function buildPollWebhookPayload(input: {
  providerPaymentId: string;
  status: "completed" | "failed";
  amount?: number;
  orderId?: string;
}): { payload: PollConfirmationPayload; rawBody: string } {
  const providerEventId = buildPollEventId(input.providerPaymentId, input.status);
  const body = {
    event_id: providerEventId,
    payment_id: input.providerPaymentId,
    order_id: input.orderId,
    status: input.status,
    amount: input.amount,
    source: "api_poll",
  };

  return {
    payload: {
      providerEventId,
      providerPaymentId: input.providerPaymentId,
      orderId: input.orderId,
      status: input.status,
      amount: input.amount,
    },
    rawBody: JSON.stringify(body),
  };
}
