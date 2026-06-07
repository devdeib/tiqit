import { jsonOk, withAdminWriteHandler } from "@/lib/api/admin-handler";
import { logAdminAction } from "@/services/admin/audit.service";
import { approveManualPayment } from "@/services/manual-payment.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ paymentId: string }> };

export async function POST(request: Request, { params }: Params) {
  return withAdminWriteHandler(
    async (_ctx, admin) => {
      const { paymentId } = await params;
      const result = await approveManualPayment({
        paymentId,
        adminUserId: admin.profile.id,
      });

      await logAdminAction(admin, {
        action: "approve_manual_payment",
        entityType: "payment",
        entityId: paymentId,
        metadata: { orderId: result.orderId, alreadyProcessed: result.alreadyProcessed },
      });

      return jsonOk({ result });
    },
    { request, route: "POST /api/admin/payments/[paymentId]/approve" },
  );
}
