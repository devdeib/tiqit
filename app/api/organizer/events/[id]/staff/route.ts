import { jsonOk, withOrganizerReadHandler, withOrganizerWriteHandler } from "@/lib/api/organizer-handler";
import { AppError } from "@/lib/errors";
import { assignStaffSchema } from "@/lib/validators/organizer-schemas";
import {
  assignStaffToEvent,
  listEventStaffAssignments,
  listStaffOptions,
} from "@/services/organizer/staff.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withOrganizerReadHandler(
    async (_ctx, org) => {
      const { id } = await params;
      const [assignments, staffOptions] = await Promise.all([
        listEventStaffAssignments(org, id),
        listStaffOptions(org),
      ]);
      return jsonOk({ assignments, staffOptions });
    },
    { request, route: "GET /api/organizer/events/[id]/staff" },
  );
}

export async function POST(request: Request, { params }: Params) {
  return withOrganizerWriteHandler(
    async (_ctx, org) => {
      const { id } = await params;
      const body = await request.json().catch(() => null);
      const parsed = assignStaffSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid request body", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: { issues: parsed.error.flatten() },
        });
      }

      const assignment = await assignStaffToEvent(org, id, parsed.data.staffId);
      return jsonOk({ assignment }, 201);
    },
    { request, route: "POST /api/organizer/events/[id]/staff" },
  );
}
