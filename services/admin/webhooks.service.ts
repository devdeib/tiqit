import { AppError } from "@/lib/errors";
import type { AdminContext } from "@/lib/admin-auth";
import type { AdminStuckPayment } from "@/types/admin";
import { processPaymentWebhook } from "@/services/fulfillment.service";
import { logAdminAction } from "@/services/admin/audit.service";
import type { Json } from "@/types/database";

const STUCK_MINUTES = 15;

export async function listStuckPayments(
  admin: AdminContext,
): Promise<AdminStuckPayment[]> {
  const { data: payments, error } = await admin.supabase
    .from("payments")
    .select(
      "id, order_id, provider_payment_id, status, amount, webhook_verified, raw_webhook_payload, created_at",
    )
    .in("status", ["pending", "completed"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new AppError("Failed to load payments", { code: "DATABASE", cause: error });
  }

  const cutoff = Date.now() - STUCK_MINUTES * 60 * 1000;
  const rows: AdminStuckPayment[] = [];

  for (const p of payments ?? []) {
    const { data: order } = await admin.supabase
      .from("orders")
      .select("id, status")
      .eq("id", p.order_id)
      .maybeSingle();
    if (!order) continue;

    const stuckCompleted =
      p.status === "completed" && !p.webhook_verified && order.status !== "confirmed";
    const stuckPending =
      p.status === "pending" &&
      order.status === "pending" &&
      new Date(p.created_at).getTime() < cutoff;

    if (!stuckCompleted && !stuckPending) continue;

    rows.push({
      paymentId: p.id,
      orderId: order.id,
      providerPaymentId: p.provider_payment_id,
      paymentStatus: p.status,
      orderStatus: order.status,
      webhookVerified: p.webhook_verified,
      amount: Number(p.amount),
      createdAt: p.created_at,
      hasStoredPayload: p.raw_webhook_payload != null,
    });
  }

  return rows;
}

export async function replayPaymentWebhook(
  admin: AdminContext,
  paymentId: string,
): Promise<{ orderId: string; alreadyProcessed: boolean }> {
  const { data: payment, error } = await admin.supabase
    .from("payments")
    .select("id, order_id, provider_payment_id, amount, status, raw_webhook_payload")
    .eq("id", paymentId)
    .maybeSingle();

  if (error || !payment) {
    throw new AppError("Payment not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  const { data: order } = await admin.supabase
    .from("orders")
    .select("status")
    .eq("id", payment.order_id)
    .maybeSingle();

  if (!order) {
    throw new AppError("Order not found for payment", { code: "NOT_FOUND", status: 404, expose: true });
  }

  if (order.status === "confirmed") {
    throw new AppError("Order is already confirmed", {
      code: "CONFLICT",
      status: 409,
      expose: true,
    });
  }

  const rawPayload = payment.raw_webhook_payload as Record<string, unknown> | null;
  let rawBody: string;
  let providerEventId: string;
  let status: "completed" | "failed" = "completed";

  if (rawPayload && typeof rawPayload === "object") {
    rawBody = JSON.stringify(rawPayload);
    providerEventId =
      typeof rawPayload.event_id === "string"
        ? rawPayload.event_id
        : typeof rawPayload.provider_event_id === "string"
          ? rawPayload.provider_event_id
          : `replay_${payment.provider_payment_id}`;
    if (rawPayload.status === "failed") status = "failed";
  } else {
    providerEventId = `admin_replay_${payment.provider_payment_id}`;
    rawBody = JSON.stringify({
      event_id: providerEventId,
      payment_id: payment.provider_payment_id,
      status: "completed",
      amount: payment.amount,
    });
  }

  const result = await processPaymentWebhook(
    {
      providerEventId,
      providerPaymentId: payment.provider_payment_id,
      orderId: payment.order_id,
      status,
      amount: Number(payment.amount),
    },
    rawBody,
  );

  await logAdminAction(admin, {
    action: "webhook.replay",
    entityType: "payment",
    entityId: paymentId,
    metadata: {
      orderId: result.orderId,
      alreadyProcessed: result.alreadyProcessed,
      providerEventId,
    },
  });

  return { orderId: result.orderId, alreadyProcessed: result.alreadyProcessed };
}

export async function listRecentAuditLogs(
  admin: AdminContext,
  limit = 30,
): Promise<
  {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: Json | null;
    createdAt: string;
    adminName: string;
  }[]
> {
  const { data: logs, error } = await admin.supabase
    .from("admin_audit_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, admin_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError("Failed to load audit logs", { code: "DATABASE", cause: error });
  }

  const rows = [];
  for (const log of logs ?? []) {
    const { data: adminUser } = await admin.supabase
      .from("users")
      .select("full_name")
      .eq("id", log.admin_id)
      .maybeSingle();

    rows.push({
      id: log.id,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      metadata: log.metadata,
      createdAt: log.created_at,
      adminName: adminUser?.full_name ?? "Admin",
    });
  }

  return rows;
}
