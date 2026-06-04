import { jsonOk, withOrganizerWriteHandler } from "@/lib/api/organizer-handler";
import { submitOrganizerEventForApproval } from "@/services/organizer/events.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withOrganizerWriteHandler(
    async (_ctx, org) => {
      const { id } = await params;
      const event = await submitOrganizerEventForApproval(org, id);
      return jsonOk({ event });
    },
    { request, route: "POST /api/organizer/events/[id]/submit" },
  );
}
