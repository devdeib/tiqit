import { jsonOk, withAdminReadHandler, withAdminWriteHandler } from "@/lib/api/admin-handler";
import { AppError } from "@/lib/errors";
import { createOrganizerUserSchema } from "@/lib/validators/admin-schemas";
import { createOrganizerProfile, listAdminUsers } from "@/services/admin/users.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAdminReadHandler(
    async (_ctx, admin) => {
      const users = await listAdminUsers(admin);
      return jsonOk({ users });
    },
    { request, route: "GET /api/admin/users" },
  );
}

export async function POST(request: Request) {
  return withAdminWriteHandler(
    async (_ctx, admin) => {
      const body = await request.json().catch(() => null);
      const parsed = createOrganizerUserSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid request body", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: { issues: parsed.error.flatten() },
        });
      }
      const user = await createOrganizerProfile(admin, {
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        password: parsed.data.password,
        organizerStatus: parsed.data.organizerStatus,
      });
      return jsonOk({ user }, 201);
    },
    { request, route: "POST /api/admin/users" },
  );
}
