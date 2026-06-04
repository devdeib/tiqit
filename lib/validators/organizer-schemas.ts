import { z } from "zod";

const editableEventStatuses = ["draft", "pending_approval"] as const;

export const createOrganizerEventSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional().nullable(),
  venue: z.string().min(2).max(300),
  eventDate: z.string().datetime(),
  saleEndsAt: z.string().datetime(),
  maxTicketsPerOrder: z.number().int().positive().max(100).optional(),
  refundPolicyNote: z.string().max(2000).optional().nullable(),
});

export const updateOrganizerEventSchema = createOrganizerEventSchema.partial();

export const createTicketTypeSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  price: z.number().nonnegative(),
  totalCapacity: z.number().int().positive(),
});

export const updateTicketTypeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional().nullable(),
  price: z.number().nonnegative().optional(),
  totalCapacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const assignStaffSchema = z.object({
  staffId: z.string().uuid(),
});

export { editableEventStatuses };
