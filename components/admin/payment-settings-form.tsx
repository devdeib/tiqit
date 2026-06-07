"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch, adminFetchForm } from "@/lib/api/admin-client";
import type { AdminPaymentSettings } from "@/types/admin";

type LinkedAccount = {
  id: string;
  label: string | null;
  status: string | null;
};

type ShamCashConnectionStatus = {
  hasApiKey: boolean;
  linkedAccounts: LinkedAccount[];
  configuredApiAccountId: string | null;
  resolvedAccountId: string | null;
  message: string | null;
};

export function PaymentSettingsForm({ initial }: { initial: AdminPaymentSettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [accountId, setAccountId] = useState(initial.shamCashAccountId);
  const [apiAccountId, setApiAccountId] = useState(initial.shamCashApiAccountId);
  const [accountName, setAccountName] = useState(initial.shamCashAccountName);
  const [instructions, setInstructions] = useState(initial.paymentInstructions);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [connection, setConnection] = useState<ShamCashConnectionStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadConnection() {
      setLoadingAccounts(true);
      try {
        const res = await adminFetch<{ status: ShamCashConnectionStatus }>(
          "/api/admin/settings/payments/sham-cash-accounts",
        );
        if (cancelled) return;
        setConnection(res.status);
        if (!initial.shamCashApiAccountId && res.status.configuredApiAccountId) {
          setApiAccountId(res.status.configuredApiAccountId);
        } else if (
          !initial.shamCashApiAccountId &&
          res.status.linkedAccounts.length === 1
        ) {
          setApiAccountId(res.status.linkedAccounts[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setConnection({
            hasApiKey: false,
            linkedAccounts: [],
            configuredApiAccountId: null,
            resolvedAccountId: null,
            message: err instanceof Error ? err.message : "Could not load Sham Cash accounts",
          });
        }
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    }

    void loadConnection();
    return () => {
      cancelled = true;
    };
  }, [initial.shamCashApiAccountId]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await adminFetch<{ settings: AdminPaymentSettings }>(
        "/api/admin/settings/payments",
        {
          method: "PUT",
          body: JSON.stringify({
            shamCashAccountId: accountId.trim(),
            shamCashApiAccountId: apiAccountId.trim(),
            shamCashAccountName: accountName.trim(),
            paymentInstructions: instructions.trim(),
          }),
        },
      );
      setSettings(res.settings);
      setApiAccountId(res.settings.shamCashApiAccountId);
      setMessage("Payment settings saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function uploadQr() {
    if (!qrFile) {
      setError("Choose a QR image first.");
      return;
    }

    setUploadingQr(true);
    setMessage(null);
    setError(null);

    try {
      const form = new FormData();
      form.set("qr", qrFile);
      const res = await adminFetchForm<{ qrImageUrl: string }>(
        "/api/admin/settings/payments/qr",
        form,
      );
      setSettings((s) => ({ ...s, shamCashQrImageUrl: res.qrImageUrl }));
      setQrFile(null);
      setMessage("QR image uploaded.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingQr(false);
    }
  }

  const qrUrl = settings.shamCashQrImageUrl;

  return (
    <div className="space-y-8">
      <section className="max-w-xl rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-medium">Two different IDs are required</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>API key</strong> (Vercel: <code>SHAM_CASH_API_KEY</code>) — lets the server
            talk to Sham Cash. You already set this.
          </li>
          <li>
            <strong>Verification account</strong> — the linked Sham Cash account whose transactions
            we query. This is <em>not</em> the same as the API key. Pick it below.
          </li>
          <li>
            <strong>Customer wallet ID</strong> — what buyers see at checkout (phone/wallet number
            they send money to).
          </li>
        </ul>
      </section>

      <form onSubmit={(e) => void saveSettings(e)} className="max-w-xl space-y-4 rounded border bg-white p-6">
        <h2 className="text-lg font-semibold">Sham Cash verification</h2>

        {loadingAccounts ? (
          <p className="text-sm text-neutral-600">Loading linked Sham Cash accounts…</p>
        ) : connection?.hasApiKey ? (
          <div className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
            {connection.message ? (
              <p className="text-red-600">{connection.message}</p>
            ) : connection.linkedAccounts.length ? (
              <>
                <p className="text-neutral-700">
                  API key is working. Select which linked account to use when verifying payments.
                </p>
                <label className="block">
                  <span className="font-medium">Verification account</span>
                  <select
                    required
                    value={apiAccountId}
                    onChange={(e) => setApiAccountId(e.target.value)}
                    className="mt-1 w-full rounded border bg-white px-3 py-2"
                  >
                    <option value="">Select an account…</option>
                    {connection.linkedAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label ? `${account.label} — ` : ""}
                        {account.id}
                        {account.status ? ` (${account.status})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {connection.resolvedAccountId && (
                  <p className="text-xs text-neutral-500">
                    Currently used for verification: {connection.resolvedAccountId}
                  </p>
                )}
              </>
            ) : (
              <p className="text-red-600">
                API key is set but no linked accounts were returned. Check your Sham Cash API
                subscription and that the receiver account is linked on shamcash-api.com.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-red-600">
            {connection?.message ??
              "Add SHAM_CASH_API_KEY (or SHAMCASH_API_TOKEN) on Vercel and redeploy, then reload this page."}
          </p>
        )}

        <h2 className="pt-2 text-lg font-semibold">Customer-facing account</h2>

        <label className="block text-sm">
          <span className="font-medium">Wallet / account number</span>
          <p className="mt-1 text-xs text-neutral-500">
            Shown to customers at checkout — the Sham Cash number they send payment to.
          </p>
          <input
            type="text"
            required
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Account name</span>
          <input
            type="text"
            required
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Payment instructions</span>
          <textarea
            required
            rows={5}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>

        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving || (connection?.hasApiKey && connection.linkedAccounts.length > 0 && !apiAccountId)}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>

      <section className="max-w-xl space-y-4 rounded border bg-white p-6">
        <h2 className="text-lg font-semibold">QR code image</h2>
        {qrUrl ? (
          <img src={qrUrl} alt="Sham Cash QR code" className="max-h-48 rounded border" />
        ) : (
          <p className="text-sm text-neutral-600">No QR image uploaded yet.</p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="font-medium">Upload new QR</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setQrFile(e.target.files?.[0] ?? null)}
              className="mt-1 block text-sm"
            />
          </label>
          <button
            type="button"
            disabled={uploadingQr || !qrFile}
            onClick={() => void uploadQr()}
            className="rounded border px-3 py-2 text-sm disabled:opacity-50"
          >
            {uploadingQr ? "Uploading…" : "Upload QR"}
          </button>
        </div>
      </section>
    </div>
  );
}
