import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { guestPhoneQuerySchema } from "@/lib/validators/schemas";
import { getCheckoutStatus } from "@/services/checkout.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orderId: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApiHandler(async () => {
    const { orderId } = await params;
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

    const status = await getCheckoutStatus(orderId, parsed.data.phone);
    return jsonOk({ status });
  });
}
