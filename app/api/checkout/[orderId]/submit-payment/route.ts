import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { assertAllowedPaymentImage } from "@/lib/storage/payment-assets";
import { submitManualPaymentFormSchema } from "@/lib/validators/schemas";
import { submitManualPaymentProof } from "@/services/manual-payment.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, { params }: Params) {
  return withApiHandler(
    async () => {
      const { orderId } = await params;
      const form = await request.formData();

      const parsed = submitManualPaymentFormSchema.safeParse({
        phone: form.get("phone"),
        transactionId: form.get("transactionId"),
      });
      if (!parsed.success) {
        throw new AppError("Invalid payment submission", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: parsed.error.flatten(),
        });
      }

      let proofFile: File | null = null;
      const proofEntry = form.get("proof");
      if (proofEntry instanceof File && proofEntry.size > 0) {
        assertAllowedPaymentImage(proofEntry);
        proofFile = proofEntry;
      }

      const result = await submitManualPaymentProof({
        orderId,
        phone: parsed.data.phone,
        transactionId: parsed.data.transactionId,
        proofFile,
      });

      return jsonOk({ result });
    },
    { request, route: "POST /api/checkout/[orderId]/submit-payment", rateLimit: RATE_LIMITS.guestWrite },
  );
}
