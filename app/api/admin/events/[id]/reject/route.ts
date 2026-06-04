import { jsonOk, withAdminWriteHandler } from "@/lib/api/admin-handler";
import { AppError } from "@/lib/errors";
import { rejectEventSchema } from "@/lib/validators/admin-schemas";
import { rejectEvent } from "@/services/admin/events.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withAdminWriteHandler(
    async (_ctx, admin) => {
      const { id } = await params;
      const body = await request.json().catch(() => ({}));
      const parsed = rejectEventSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid request body", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
        });
      }
      const event = await rejectEvent(admin, id, parsed.data.reason);
      return jsonOk({ event });
    },
    { request, route: "POST /api/admin/events/[id]/reject" },
  );
}
