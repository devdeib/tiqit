import { jsonOk, withAdminReadHandler } from "@/lib/api/admin-handler";
import { getShamCashApiToken } from "@/services/sham-cash/config";
import { listShamCashAccounts, resolveShamCashApiAccountId } from "@/services/sham-cash/accounts";
import { getPlatformPaymentSettings } from "@/services/payment-settings.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAdminReadHandler(
    async () => {
      const settings = await getPlatformPaymentSettings();
      const hasApiKey = Boolean(getShamCashApiToken());

      if (!hasApiKey) {
        return jsonOk({
          status: {
            hasApiKey: false,
            linkedAccounts: [],
            configuredApiAccountId: settings.sham_cash_api_account_id || null,
            resolvedAccountId: null,
            message:
              "Add SHAM_CASH_API_KEY or SHAMCASH_API_TOKEN on Vercel, then redeploy.",
          },
        });
      }

      try {
        const linkedAccounts = await listShamCashAccounts();
        const resolvedAccountId = await resolveShamCashApiAccountId(
          settings.sham_cash_account_id,
          undefined,
          settings.sham_cash_api_account_id,
        );

        return jsonOk({
          status: {
            hasApiKey: true,
            linkedAccounts: linkedAccounts.map((account) => ({
              id: account.id,
              label: account.label,
              status: account.status,
            })),
            configuredApiAccountId: settings.sham_cash_api_account_id || null,
            resolvedAccountId,
            message: null,
          },
        });
      } catch (err) {
        return jsonOk({
          status: {
            hasApiKey: true,
            linkedAccounts: [],
            configuredApiAccountId: settings.sham_cash_api_account_id || null,
            resolvedAccountId: null,
            message: err instanceof Error ? err.message : "Could not load Sham Cash accounts",
          },
        });
      }
    },
    { request, route: "GET /api/admin/settings/payments/sham-cash-accounts" },
  );
}
