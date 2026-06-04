import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { getPublicEvent } from "@/services/events.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withApiHandler(async () => {
    const { id } = await params;
    const event = await getPublicEvent(id);
    return jsonOk({ event });
  });
}
