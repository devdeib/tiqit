import { CheckoutForm } from "@/components/checkout/checkout-form";

type Props = { params: Promise<{ reservationId: string }> };

export default async function CheckoutPage({ params }: Props) {
  const { reservationId } = await params;

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <CheckoutForm reservationId={reservationId} />
    </main>
  );
}
