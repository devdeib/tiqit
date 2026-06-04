import { jsonOk, withAdminWriteHandler } from "@/lib/api/admin-handler";
import { approveEvent } from "@/services/admin/events.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withAdminWriteHandler(
    async (_ctx, admin) => {
      const { id } = await params;
      const event = await approveEvent(admin, id);
      return jsonOk({ event });
    },
    { request, route: "POST /api/admin/events/[id]/approve" },
  );
}
