import { jsonOk, withAdminWriteHandler } from "@/lib/api/admin-handler";
import { AppError } from "@/lib/errors";
import { uploadShamCashQrImage } from "@/lib/storage/payment-assets";
import { logAdminAction } from "@/services/admin/audit.service";
import {
  getPlatformPaymentSettings,
  updatePlatformPaymentSettings,
} from "@/services/payment-settings.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withAdminWriteHandler(
    async (_ctx, admin) => {
      const form = await request.formData();
      const fileEntry = form.get("qr");
      if (!(fileEntry instanceof File) || fileEntry.size === 0) {
        throw new AppError("QR image file is required", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
        });
      }

      const qrImageUrl = await uploadShamCashQrImage(fileEntry);
      const existing = await getPlatformPaymentSettings();

      const row = await updatePlatformPaymentSettings({
        shamCashAccountId: existing.sham_cash_account_id,
        shamCashAccountName: existing.sham_cash_account_name,
        paymentInstructions: existing.payment_instructions,
        shamCashQrImageUrl: qrImageUrl,
        updatedBy: admin.profile.id,
      });

      await logAdminAction(admin, {
        action: "upload_sham_cash_qr",
        entityType: "platform_payment_settings",
        entityId: row.id,
      });

      return jsonOk({ qrImageUrl: row.sham_cash_qr_image_url });
    },
    { request, route: "POST /api/admin/settings/payments/qr" },
  );
}
