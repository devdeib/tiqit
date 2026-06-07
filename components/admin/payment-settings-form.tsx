"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch, adminFetchForm } from "@/lib/api/admin-client";
import type { AdminPaymentSettings } from "@/types/admin";

export function PaymentSettingsForm({ initial }: { initial: AdminPaymentSettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [accountId, setAccountId] = useState(initial.shamCashAccountId);
  const [accountName, setAccountName] = useState(initial.shamCashAccountName);
  const [instructions, setInstructions] = useState(initial.paymentInstructions);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            shamCashAccountName: accountName.trim(),
            paymentInstructions: instructions.trim(),
          }),
        },
      );
      setSettings(res.settings);
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
      <form onSubmit={(e) => void saveSettings(e)} className="max-w-xl space-y-4 rounded border bg-white p-6">
        <h2 className="text-lg font-semibold">Sham Cash account</h2>

        <label className="block text-sm">
          <span className="font-medium">Account ID</span>
          <p className="mt-1 text-xs text-neutral-500">
            Wallet or account number shown to customers when they pay (e.g. Sham Cash phone/wallet
            ID). Verification uses your linked API account automatically, or set
            SHAM_CASH_API_ACCOUNT_ID in Vercel.
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
          disabled={saving}
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
