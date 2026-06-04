import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createReservationSchema } from "@/lib/validators/schemas";
import { createReservation } from "@/services/reservations.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiHandler(
    async () => {
      const body = await request.json().catch(() => null);
      const parsed = createReservationSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError("Invalid request body", {
          code: "VALIDATION_ERROR",
          status: 400,
          expose: true,
          details: { issues: parsed.error.flatten() },
        });
      }

      const reservation = await createReservation({
        eventId: parsed.data.eventId,
        items: parsed.data.items,
        guest: {
          fullName: parsed.data.guest.fullName,
          phone: parsed.data.guest.phone,
          email: parsed.data.guest.email,
        },
      });

      return jsonOk({ reservation }, 201);
    },
    { request, route: "POST /api/reservations", rateLimit: RATE_LIMITS.guestWrite },
  );
}
