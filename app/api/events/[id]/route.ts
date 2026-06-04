import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getPublicEvent } from "@/services/events.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApiHandler(
    async () => {
      const { id } = await params;
      const event = await getPublicEvent(id);
      return jsonOk({ event });
    },
    { request, route: "GET /api/events/[id]", rateLimit: RATE_LIMITS.guestRead },
  );
}
