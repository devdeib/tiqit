import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { assertAdminApiKey } from "@/lib/admin-auth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { forceReleaseReservation } from "@/services/admin-emergency.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withApiHandler(
    async () => {
      assertAdminApiKey(request);
      const { id } = await params;
      const result = await forceReleaseReservation(id);
      return jsonOk({ result });
    },
    {
      request,
      route: "POST /api/admin/reservations/[id]/release",
      rateLimit: RATE_LIMITS.admin,
    },
  );
}
