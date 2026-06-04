import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { assertGuestOwnsReservation } from "@/lib/guest-ownership";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { guestPhoneQuerySchema } from "@/lib/validators/schemas";
import { getReservation } from "@/services/reservations.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApiHandler(
    async () => {
      const { id } = await params;
      const url = new URL(request.url);
      const parsed = guestPhoneQuerySchema.safeParse({
        phone: url.searchParams.get("phone"),
      });
      if (!parsed.success) {
        throw new AppError("phone query parameter is required (E.164)", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
        });
      }

      await assertGuestOwnsReservation(id, parsed.data.phone);
      const reservation = await getReservation(id);
      return jsonOk({ reservation });
    },
    { request, route: "GET /api/reservations/[id]", rateLimit: RATE_LIMITS.guestRead },
  );
}
