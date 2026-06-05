"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { staffFetch } from "@/lib/api/staff-client";
import { QrScanner } from "@/components/staff/qr-scanner";
import type { StaffScanResult } from "@/types/staff";

const outcomeStyles: Record<string, string> = {
  valid: "border-green-500 bg-green-50 text-green-900",
  already_used: "border-amber-500 bg-amber-50 text-amber-900",
  wrong_event: "border-red-500 bg-red-50 text-red-900",
  invalid: "border-red-500 bg-red-50 text-red-900",
  voided: "border-red-500 bg-red-50 text-red-900",
  not_authorized: "border-red-500 bg-red-50 text-red-900",
};

export function ScanConsole({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const [manualToken, setManualToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<StaffScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitScan = useCallback(
    async (qrToken: string) => {
      if (!qrToken.trim() || loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await staffFetch<{ result: StaffScanResult }>("/api/staff/scan", {
          method: "POST",
          body: JSON.stringify({ eventId, qrToken: qrToken.trim() }),
        });
        setLastResult(res.result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Scan failed");
      } finally {
        setLoading(false);
      }
    },
    [eventId, loading],
  );

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/staff" className="text-sm text-neutral-600 underline">
          ← Events
        </Link>
        <h1 className="mt-2 text-xl font-bold">{eventTitle}</h1>
        <Link
          href={`/staff/events/${eventId}/stats`}
          className="mt-1 inline-block text-sm text-neutral-600 underline"
        >
          View scan stats
        </Link>
      </div>

      <QrScanner onScan={submitScan} disabled={loading} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitScan(manualToken);
        }}
        className="space-y-2"
      >
        <label className="block text-sm font-medium">Manual QR payload</label>
        <textarea
          value={manualToken}
          onChange={(e) => setManualToken(e.target.value)}
          placeholder="v1:token:signature"
          rows={3}
          className="w-full rounded border px-3 py-2 font-mono text-xs"
        />
        <button
          type="submit"
          disabled={loading || !manualToken.trim()}
          className="w-full rounded bg-black py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Checking…" : "Submit token"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {lastResult && (
        <div
          className={`rounded-lg border-2 p-4 ${outcomeStyles[lastResult.outcome] ?? outcomeStyles.invalid}`}
        >
          <p className="text-lg font-bold uppercase tracking-wide">{lastResult.outcome}</p>
          <p className="mt-1">{lastResult.message}</p>
          {lastResult.ticket && (
            <dl className="mt-4 space-y-1 text-sm">
              <div>
                <dt className="text-neutral-600">Holder</dt>
                <dd className="font-medium">{lastResult.ticket.holderName}</dd>
              </div>
              <div>
                <dt className="text-neutral-600">Ticket type</dt>
                <dd>{lastResult.ticket.ticketTypeName}</dd>
              </div>
              {lastResult.scannedAt && (
                <div>
                  <dt className="text-neutral-600">Scanned at</dt>
                  <dd>{new Date(lastResult.scannedAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
