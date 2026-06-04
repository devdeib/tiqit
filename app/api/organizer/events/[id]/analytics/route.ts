import { jsonOk, withOrganizerReadHandler } from "@/lib/api/organizer-handler";
import { getOrganizerEventAnalytics } from "@/services/organizer/analytics.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withOrganizerReadHandler(
    async (_ctx, org) => {
      const { id } = await params;
      const analytics = await getOrganizerEventAnalytics(org, id);
      return jsonOk({ analytics });
    },
    { request, route: "GET /api/organizer/events/[id]/analytics" },
  );
}
