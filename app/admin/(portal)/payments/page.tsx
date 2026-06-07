import { PendingPaymentsList } from "@/components/admin/pending-payments-list";
import { getAdminContext } from "@/lib/admin-auth";
import { listPendingManualPayments } from "@/services/admin/payments.service";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const admin = await getAdminContext();
  if (!admin) return null;

  const payments = await listPendingManualPayments(admin);

  return (
    <main className="py-8">
      <h1 className="text-2xl font-bold">Payment review</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Approve or reject Sham Cash manual payments submitted by customers.
      </p>
      <div className="mt-8">
        <PendingPaymentsList payments={payments} />
      </div>
    </main>
  );
}
