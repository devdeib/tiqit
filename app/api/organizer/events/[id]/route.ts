import { jsonOk, withOrganizerReadHandler, withOrganizerWriteHandler } from "@/lib/api/organizer-handler";
import { AppError } from "@/lib/errors";
import { updateOrganizerEventSchema } from "@/lib/validators/organizer-schemas";
import {
  getOrganizerEvent,
  updateOrganizerEvent,
} from "@/services/organizer/events.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withOrganizerReadHandler(
    async (_ctx, org) => {
      const { id } = await params;
      const event = await getOrganizerEvent(org, id);
      return jsonOk({ event });
    },
    { request, route: "GET /api/organizer/events/[id]" },
  );
}

export async function PATCH(request: Request, { params }: Params) {
  return withOrganizerWriteHandler(
    async (_ctx, org) => {
      const { id } = await params;
      const body = await request.json().catch(() => null);
      const parsed = updateOrganizerEventSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid request body", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: { issues: parsed.error.flatten() },
        });
      }

      const event = await updateOrganizerEvent(org, id, {
        title: parsed.data.title,
        description: parsed.data.description,
        venue: parsed.data.venue,
        eventDate: parsed.data.eventDate,
        saleEndsAt: parsed.data.saleEndsAt,
        maxTicketsPerOrder: parsed.data.maxTicketsPerOrder,
        refundPolicyNote: parsed.data.refundPolicyNote,
      });

      return jsonOk({ event });
    },
    { request, route: "PATCH /api/organizer/events/[id]" },
  );
}
