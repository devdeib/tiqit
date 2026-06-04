import { jsonOk, withOrganizerWriteHandler } from "@/lib/api/organizer-handler";
import { AppError } from "@/lib/errors";
import { updateTicketTypeSchema } from "@/lib/validators/organizer-schemas";
import {
  deleteOrganizerTicketType,
  updateOrganizerTicketType,
} from "@/services/organizer/ticket-types.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; typeId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withOrganizerWriteHandler(
    async (_ctx, org) => {
      const { id, typeId } = await params;
      const body = await request.json().catch(() => null);
      const parsed = updateTicketTypeSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid request body", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: { issues: parsed.error.flatten() },
        });
      }

      const ticketType = await updateOrganizerTicketType(org, id, typeId, {
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        totalCapacity: parsed.data.totalCapacity,
        isActive: parsed.data.isActive,
      });

      return jsonOk({ ticketType });
    },
    { request, route: "PATCH /api/organizer/events/[id]/ticket-types/[typeId]" },
  );
}

export async function DELETE(request: Request, { params }: Params) {
  return withOrganizerWriteHandler(
    async (_ctx, org) => {
      const { id, typeId } = await params;
      await deleteOrganizerTicketType(org, id, typeId);
      return jsonOk({ ok: true });
    },
    { request, route: "DELETE /api/organizer/events/[id]/ticket-types/[typeId]" },
  );
}
