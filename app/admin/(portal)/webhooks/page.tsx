import { WebhookReplayList } from "@/components/admin/webhook-replay-list";
import { getAdminContext } from "@/lib/admin-auth";
import { listRecentAuditLogs, listStuckPayments } from "@/services/admin/webhooks.service";

export const dynamic = "force-dynamic";

export default async function AdminWebhooksPage() {
  const admin = await getAdminContext();
  if (!admin) return null;

  const [stuckPayments, audit] = await Promise.all([
    listStuckPayments(admin),
    listRecentAuditLogs(admin, 30),
  ]);

  return (
    <main className="py-8">
      <h1 className="text-2xl font-bold">Webhooks & payments</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Stuck payments and replay via existing fulfillment idempotency.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Stuck / failed fulfillment</h2>
        <div className="mt-4">
          <WebhookReplayList stuckPayments={stuckPayments} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recent admin audit log</h2>
        {audit.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">No actions yet.</p>
        ) : (
          <ul className="mt-4 divide-y rounded border bg-white text-sm">
            {audit.map((log) => (
              <li key={log.id} className="p-3">
                <span className="font-medium">{log.action}</span> on {log.entityType}
                {log.entityId ? ` ${log.entityId.slice(0, 8)}…` : ""} by {log.adminName} ·{" "}
                {new Date(log.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
