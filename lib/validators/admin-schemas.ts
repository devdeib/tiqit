import { z } from "zod";

export const createOrganizerUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(200),
  password: z.string().min(8).max(128),
  organizerStatus: z.enum(["pending", "approved"]).optional().default("pending"),
});

export const updateAdminUserSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  isActive: z.boolean().optional(),
  organizerStatus: z.enum(["pending", "approved", "suspended"]).optional(),
  role: z.enum(["organizer", "staff"]).optional(),
});

export const rejectEventSchema = z.object({
  reason: z.string().max(2000).optional(),
});

export const updatePaymentSettingsSchema = z.object({
  shamCashAccountId: z.string().min(1).max(120),
  shamCashAccountName: z.string().min(1).max(200),
  paymentInstructions: z.string().min(1).max(4000),
});

export const rejectManualPaymentSchema = z.object({
  reason: z.string().max(2000).optional(),
});
