import Link from "next/link";
import { getAdminContext } from "@/lib/admin-auth";
import { inspectAdminOrder } from "@/services/admin/orders.service";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function AdminOrderDetailPage({ params }: Props) {
  const admin = await getAdminContext();
  if (!admin) return null;
  const { id } = await params;
  const data = await inspectAdminOrder(admin, id);

  return (
    <main style={{ paddingTop: "32px" }}>
      <Link href="/admin/webhooks" style={{ fontSize: "10px", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tq-muted)", textDecoration: "none", marginBottom: "24px", display: "inline-block" }}>← Webhooks</Link>
      <h1 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: "6px" }}>
        Order {data.order.id.slice(0, 8)}…
      </h1>
      <p style={{ fontSize: "13px", color: "var(--tq-muted)", marginBottom: "28px" }}>
        Status: <strong style={{ color: "var(--tq-off)" }}>{data.order.status}</strong> · {data.order.totalAmount} SYP · Tickets issued: {data.order.ticketsIssued ? "Yes" : "No"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {data.guest && (
          <InfoCard title="Guest">
            <p style={{ fontSize: "14px", color: "var(--tq-off)" }}>{data.guest.fullName} · {data.guest.phone}{data.guest.email ? ` · ${data.guest.email}` : ""}</p>
          </InfoCard>
        )}
        {data.reservation && (
          <InfoCard title="Reservation">
            <p style={{ fontSize: "13px", color: "var(--tq-muted)", fontFamily: "var(--font-geist-mono)" }}>{data.reservation.id}</p>
          </InfoCard>
        )}
      </div>
    </main>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--tq-panel)", border: "1px solid var(--tq-rule)", borderRadius: "10px", padding: "20px" }}>
      <h2 style={{ fontSize: "13px", fontWeight: 700, color: "var(--tq-off)", marginBottom: "10px", letterSpacing: "-0.01em" }}>{title}</h2>
      {children}
    </div>
  );
}
