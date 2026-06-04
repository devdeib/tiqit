import { jsonOk, withOrganizerReadHandler } from "@/lib/api/organizer-handler";
import { listOrganizerEventOrders } from "@/services/organizer/orders.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withOrganizerReadHandler(
    async (_ctx, org) => {
      const { id } = await params;
      const orders = await listOrganizerEventOrders(org, id);
      return jsonOk({ orders });
    },
    { request, route: "GET /api/organizer/events/[id]/orders" },
  );
}
