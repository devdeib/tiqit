import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { listPublicEvents } from "@/services/events.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiHandler(
    async () => {
      const events = await listPublicEvents();
      return jsonOk({ events });
    },
    { request, route: "GET /api/events", rateLimit: RATE_LIMITS.guestRead },
  );
}
