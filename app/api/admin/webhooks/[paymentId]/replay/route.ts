import { jsonOk, withAdminWriteHandler } from "@/lib/api/admin-handler";
import { replayPaymentWebhook } from "@/services/admin/webhooks.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ paymentId: string }> };

export async function POST(request: Request, { params }: Params) {
  return withAdminWriteHandler(
    async (_ctx, admin) => {
      const { paymentId } = await params;
      const result = await replayPaymentWebhook(admin, paymentId);
      return jsonOk({ result });
    },
    { request, route: "POST /api/admin/webhooks/[paymentId]/replay" },
  );
}
