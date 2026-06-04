import { jsonOk, withOrganizerReadHandler, withOrganizerWriteHandler } from "@/lib/api/organizer-handler";
import { AppError } from "@/lib/errors";
import { createTicketTypeSchema } from "@/lib/validators/organizer-schemas";
import {
  createOrganizerTicketType,
  listOrganizerTicketTypes,
} from "@/services/organizer/ticket-types.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withOrganizerReadHandler(
    async (_ctx, org) => {
      const { id } = await params;
      const ticketTypes = await listOrganizerTicketTypes(org, id);
      return jsonOk({ ticketTypes });
    },
    { request, route: "GET /api/organizer/events/[id]/ticket-types" },
  );
}

export async function POST(request: Request, { params }: Params) {
  return withOrganizerWriteHandler(
    async (_ctx, org) => {
      const { id } = await params;
      const body = await request.json().catch(() => null);
      const parsed = createTicketTypeSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid request body", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: { issues: parsed.error.flatten() },
        });
      }

      const ticketType = await createOrganizerTicketType(org, id, {
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        totalCapacity: parsed.data.totalCapacity,
      });

      return jsonOk({ ticketType }, 201);
    },
    { request, route: "POST /api/organizer/events/[id]/ticket-types" },
  );
}
