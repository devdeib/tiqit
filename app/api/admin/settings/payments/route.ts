import { jsonOk, withAdminReadHandler, withAdminWriteHandler } from "@/lib/api/admin-handler";
import { AppError } from "@/lib/errors";
import { updatePaymentSettingsSchema } from "@/lib/validators/admin-schemas";
import { logAdminAction } from "@/services/admin/audit.service";
import {
  getPlatformPaymentSettings,
  updatePlatformPaymentSettings,
} from "@/services/payment-settings.service";
import type { AdminPaymentSettings } from "@/types/admin";

export const dynamic = "force-dynamic";

function mapAdminSettings(row: Awaited<ReturnType<typeof getPlatformPaymentSettings>>): AdminPaymentSettings {
  return {
    shamCashAccountId: row.sham_cash_account_id,
    shamCashApiAccountId: row.sham_cash_api_account_id,
    shamCashAccountName: row.sham_cash_account_name,
    shamCashQrImageUrl: row.sham_cash_qr_image_url,
    paymentInstructions: row.payment_instructions,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  return withAdminReadHandler(
    async () => {
      const row = await getPlatformPaymentSettings();
      return jsonOk({ settings: mapAdminSettings(row) });
    },
    { request, route: "GET /api/admin/settings/payments" },
  );
}

export async function PUT(request: Request) {
  return withAdminWriteHandler(
    async (_ctx, admin) => {
      const body = await request.json();
      const parsed = updatePaymentSettingsSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid payment settings", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: parsed.error.flatten(),
        });
      }

      const existing = await getPlatformPaymentSettings();
      const row = await updatePlatformPaymentSettings({
        shamCashAccountId: parsed.data.shamCashAccountId,
        shamCashApiAccountId: parsed.data.shamCashApiAccountId,
        shamCashAccountName: parsed.data.shamCashAccountName,
        paymentInstructions: parsed.data.paymentInstructions,
        shamCashQrImageUrl: existing.sham_cash_qr_image_url,
        updatedBy: admin.profile.id,
      });

      await logAdminAction(admin, {
        action: "update_payment_settings",
        entityType: "platform_payment_settings",
        entityId: row.id,
      });

      return jsonOk({ settings: mapAdminSettings(row) });
    },
    { request, route: "PUT /api/admin/settings/payments" },
  );
}
