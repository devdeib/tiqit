import { jsonOk, withAdminWriteHandler } from "@/lib/api/admin-handler";
import { AppError } from "@/lib/errors";
import { updateAdminUserSchema } from "@/lib/validators/admin-schemas";
import { updateAdminUser } from "@/services/admin/users.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withAdminWriteHandler(
    async (_ctx, admin) => {
      const { id } = await params;
      const body = await request.json().catch(() => null);
      const parsed = updateAdminUserSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid request body", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: { issues: parsed.error.flatten() },
        });
      }
      const user = await updateAdminUser(admin, id, parsed.data);
      return jsonOk({ user });
    },
    { request, route: "PATCH /api/admin/users/[id]" },
  );
}
