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
    shamCashApiAccountId: row.sham_cash_api_account_id,
    shamCashAccountName: row.sham_cash_account_name,
    shamCashQrImageUrl: row.sham_cash_qr_image_url,
    paymentInstructions: row.payment_instructions,
    updatedAt: row.updated_at,
  };

  return (
    <main style={{ paddingTop:"40px", maxWidth:"600px" }}>
      <h1 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"6px" }}>Payment settings</h1>
      <p style={{ fontSize:"13px", color:"var(--tq-muted)", marginBottom:"32px" }}>Configure Sham Cash account details shown to customers at checkout.</p>
      <PaymentSettingsForm initial={settings} />
    </main>
  );
}
