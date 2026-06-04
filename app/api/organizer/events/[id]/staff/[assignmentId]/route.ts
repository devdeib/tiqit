import { jsonOk, withOrganizerWriteHandler } from "@/lib/api/organizer-handler";
import { removeStaffAssignment } from "@/services/organizer/staff.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; assignmentId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  return withOrganizerWriteHandler(
    async (_ctx, org) => {
      const { id, assignmentId } = await params;
      await removeStaffAssignment(org, id, assignmentId);
      return jsonOk({ ok: true });
    },
    { request, route: "DELETE /api/organizer/events/[id]/staff/[assignmentId]" },
  );
}
