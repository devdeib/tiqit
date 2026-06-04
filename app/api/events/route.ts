import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { listPublicEvents } from "@/services/events.service";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiHandler(async () => {
    const events = await listPublicEvents();
    return jsonOk({ events });
  });
}
