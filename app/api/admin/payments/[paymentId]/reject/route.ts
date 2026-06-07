import { jsonOk, withAdminWriteHandler } from "@/lib/api/admin-handler";
import { AppError } from "@/lib/errors";
import { rejectManualPaymentSchema } from "@/lib/validators/admin-schemas";
import { logAdminAction } from "@/services/admin/audit.service";
import { rejectManualPayment } from "@/services/manual-payment.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ paymentId: string }> };

export async function POST(request: Request, { params }: Params) {
  return withAdminWriteHandler(
    async (_ctx, admin) => {
      const { paymentId } = await params;
      const body = await request.json().catch(() => ({}));
      const parsed = rejectManualPaymentSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid reject payload", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
        });
      }

      const result = await rejectManualPayment({
        paymentId,
        adminUserId: admin.profile.id,
        reason: parsed.data.reason,
      });

      await logAdminAction(admin, {
        action: "reject_manual_payment",
        entityType: "payment",
        entityId: paymentId,
        metadata: { orderId: result.orderId, reason: parsed.data.reason ?? null },
      });

      return jsonOk({ result });
    },
    { request, route: "POST /api/admin/payments/[paymentId]/reject" },
  );
}
