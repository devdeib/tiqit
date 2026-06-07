import { z } from "zod";
import { normalizeToE164Phone } from "@/lib/phone";

export const e164PhoneSchema = z.preprocess(
  (val) => {
    if (typeof val !== "string") return val;
    return normalizeToE164Phone(val) ?? val.trim();
  },
  z
    .string()
    .regex(/^\+[1-9][0-9]{7,14}$/, "Phone must be E.164 format (e.g. +963900000001)"),
);

export const guestSchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: e164PhoneSchema,
  email: z.string().email().optional().nullable(),
});

export const reservationItemSchema = z.object({
  ticketTypeId: z.string().uuid(),
  quantity: z.int().positive(),
});

export const createReservationSchema = z.object({
  eventId: z.string().uuid(),
  items: z.array(reservationItemSchema).min(1),
  guest: guestSchema,
});

export const createCheckoutSchema = z.object({
  reservationId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(128),
  phone: e164PhoneSchema,
});

export const guestPhoneQuerySchema = z.object({
  phone: e164PhoneSchema,
});

export const simulatePaymentSchema = z.object({
  orderId: z.string().uuid(),
  phone: e164PhoneSchema,
});

export const verifyPaymentSchema = z.object({
  phone: e164PhoneSchema,
});

export const orderLookupSchema = z.object({
  orderId: z.string().uuid(),
  phone: e164PhoneSchema,
});
