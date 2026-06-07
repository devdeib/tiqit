import type { AdminContext } from "@/lib/admin-auth";
import { AppError } from "@/lib/errors";
import type { AdminPendingManualPayment } from "@/types/admin";

export async function listPendingManualPayments(
  admin: AdminContext,
): Promise<AdminPendingManualPayment[]> {
  const { data: payments, error } = await admin.supabase
    .from("payments")
    .select(
      "id, order_id, amount, currency, status, reference_code, provider_transaction_id, proof_image_url, submitted_at, created_at",
    )
    .eq("status", "pending")
    .not("proof_image_url", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new AppError("Failed to list pending payments", { code: "DATABASE", cause: error });
  }

  if (!payments?.length) return [];

  const orderIds = [...new Set(payments.map((p) => p.order_id))];
  const { data: orders } = await admin.supabase
    .from("orders")
    .select("id, status, customer_id, payment_reference_code")
    .in("id", orderIds);

  const customerIds = [...new Set((orders ?? []).map((o) => o.customer_id))];
  const { data: guests } = await admin.supabase
    .from("guest_customers")
    .select("id, full_name, phone")
    .in("id", customerIds);

  const orderMap = new Map((orders ?? []).map((o) => [o.id, o]));
  const guestMap = new Map((guests ?? []).map((g) => [g.id, g]));

  return payments.map((payment) => {
    const order = orderMap.get(payment.order_id);
    const guest = order ? guestMap.get(order.customer_id) : undefined;
    return {
      paymentId: payment.id,
      orderId: payment.order_id,
      orderReference:
        payment.reference_code ?? order?.payment_reference_code ?? payment.order_id.slice(0, 8),
      customerName: guest?.full_name ?? "Unknown",
      customerPhone: guest?.phone ?? "",
      amount: Number(payment.amount),
      currency: payment.currency,
      transactionId: payment.provider_transaction_id,
      proofImageUrl: payment.proof_image_url ?? "",
      orderStatus: order?.status ?? "unknown",
      submittedAt: payment.submitted_at ?? payment.created_at,
    };
  });
}
