import { jsonOk, withStaffWriteHandler } from "@/lib/api/staff-handler";
import { AppError } from "@/lib/errors";
import { staffScanSchema } from "@/lib/validators/staff-schemas";
import { scanStaffQr } from "@/services/staff/scan.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withStaffWriteHandler(
    async (_ctx, staff) => {
      const body = await request.json().catch(() => null);
      const parsed = staffScanSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid request body", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: { issues: parsed.error.flatten() },
        });
      }

      const result = await scanStaffQr(staff, parsed.data.eventId, parsed.data.qrToken);
      return jsonOk({ result });
    },
    { request, route: "POST /api/staff/scan" },
  );
}
