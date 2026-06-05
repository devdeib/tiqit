import { z } from "zod";

export const staffScanSchema = z.object({
  eventId: z.string().uuid(),
  qrToken: z.string().min(16).max(512),
});
