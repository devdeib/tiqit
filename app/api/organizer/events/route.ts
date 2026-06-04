import { jsonOk, withOrganizerReadHandler, withOrganizerWriteHandler } from "@/lib/api/organizer-handler";
import { AppError } from "@/lib/errors";
import { createOrganizerEventSchema } from "@/lib/validators/organizer-schemas";
import {
  createOrganizerEvent,
  listOrganizerEvents,
} from "@/services/organizer/events.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withOrganizerReadHandler(
    async (_ctx, org) => {
      const events = await listOrganizerEvents(org);
      return jsonOk({ events });
    },
    { request, route: "GET /api/organizer/events" },
  );
}

export async function POST(request: Request) {
  return withOrganizerWriteHandler(
    async (_ctx, org) => {
      const body = await request.json().catch(() => null);
      const parsed = createOrganizerEventSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid request body", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: { issues: parsed.error.flatten() },
        });
      }

      const event = await createOrganizerEvent(org, {
        title: parsed.data.title,
        description: parsed.data.description,
        venue: parsed.data.venue,
        eventDate: parsed.data.eventDate,
        saleEndsAt: parsed.data.saleEndsAt,
        maxTicketsPerOrder: parsed.data.maxTicketsPerOrder,
        refundPolicyNote: parsed.data.refundPolicyNote,
      });

      return jsonOk({ event }, 201);
    },
    { request, route: "POST /api/organizer/events" },
  );
}
