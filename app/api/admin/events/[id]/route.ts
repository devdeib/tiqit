import { jsonOk, withAdminReadHandler } from "@/lib/api/admin-handler";
import { getAdminEventDetail } from "@/services/admin/events.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withAdminReadHandler(
    async (_ctx, admin) => {
      const { id } = await params;
      const event = await getAdminEventDetail(admin, id);
      return jsonOk({ event });
    },
    { request, route: "GET /api/admin/events/[id]" },
  );
}
