import { CheckoutForm } from "@/components/checkout/checkout-form";
import { PageShell } from "@/components/ui/page-shell";

type Props = { params: Promise<{ reservationId: string }> };

export default async function CheckoutPage({ params }: Props) {
  const { reservationId } = await params;
  return (
    <PageShell>
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "48px 24px" }}>
        <a href="/" style={{ fontSize: "10px", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tq-muted)", textDecoration: "none", marginBottom: "28px", display: "inline-block" }}>← Back to events</a>
        <h1 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: "6px" }}>Checkout</h1>
        <p style={{ fontSize: "13px", color: "var(--tq-muted)", marginBottom: "24px" }}>Your tickets are held for 10 minutes.</p>
        <div style={{ background: "var(--tq-panel)", border: "1px solid var(--tq-rule)", borderTop: "2px solid var(--tq-purple)", borderRadius: "12px", padding: "24px" }}>
          <CheckoutForm reservationId={reservationId} />
        </div>
      </div>
    </PageShell>
  );
}
