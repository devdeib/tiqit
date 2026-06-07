import { PaymentSettingsForm } from "@/components/admin/payment-settings-form";
import { getAdminContext } from "@/lib/admin-auth";
import { getPlatformPaymentSettings } from "@/services/payment-settings.service";
import type { AdminPaymentSettings } from "@/types/admin";

export const dynamic = "force-dynamic";

export default async function AdminPaymentSettingsPage() {
  const admin = await getAdminContext();
  if (!admin) return null;

  const row = await getPlatformPaymentSettings();
  const settings: AdminPaymentSettings = {
    shamCashAccountId: row.sham_cash_account_id,
    shamCashAccountName: row.sham_cash_account_name,
    shamCashQrImageUrl: row.sham_cash_qr_image_url,
    paymentInstructions: row.payment_instructions,
    updatedAt: row.updated_at,
  };

  return (
    <main className="py-8">
      <h1 className="text-2xl font-bold">Payment settings</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Configure Sham Cash account details shown to customers at checkout.
      </p>
      <div className="mt-8">
        <PaymentSettingsForm initial={settings} />
      </div>
    </main>
  );
}
