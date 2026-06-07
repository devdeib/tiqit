import type { EventStatus, OrganizerStatus, OrderStatus, PaymentStatus, UserRole } from "@/types/database";

export type AdminDashboardStats = {
  eventsPendingApproval: number;
  organizersPending: number;
  stuckPayments: number;
};

export type AdminPendingEvent = {
  id: string;
  title: string;
  venue: string;
  eventDate: string;
  status: EventStatus;
  organizerId: string;
  organizerName: string;
  organizerEmail: string;
  createdAt: string;
};

export type AdminEventDetail = AdminPendingEvent & {
  description: string | null;
  saleEndsAt: string;
  maxTicketsPerOrder: number;
  refundPolicyNote: string | null;
  ticketTypeCount: number;
};

export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizerStatus: OrganizerStatus | null;
  isActive: boolean;
  createdAt: string;
};

export type AdminOrderInspection = {
  order: {
    id: string;
    status: OrderStatus;
    totalAmount: number;
    ticketsIssued: boolean;
    reservationId: string;
    eventId: string;
    idempotencyKey: string;
    createdAt: string;
    updatedAt: string;
  };
  guest: { id: string; fullName: string; phone: string; email: string | null } | null;
  reservation: {
    id: string;
    status: string;
    expiresAt: string;
    inventoryHeld: boolean;
    createdAt: string;
    items: { ticketTypeId: string; quantity: number }[];
  } | null;
  payments: {
    id: string;
    status: PaymentStatus;
    providerPaymentId: string;
    amount: number;
    webhookVerified: boolean;
    webhookReceivedAt: string | null;
    createdAt: string;
  }[];
  orderItems: { id: string; ticketTypeId: string; quantity: number; unitPrice: number; lineTotal: number }[];
  tickets: {
    id: string;
    status: string;
    ticketTypeId: string;
    holderName: string;
    createdAt: string;
  }[];
  webhookEvents: {
    providerEventId: string;
    providerPaymentId: string | null;
    processedAt: string;
  }[];
};

export type AdminStuckPayment = {
  paymentId: string;
  orderId: string;
  providerPaymentId: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  webhookVerified: boolean;
  amount: number;
  createdAt: string;
  hasStoredPayload: boolean;
};

export type AdminPendingManualPayment = {
  paymentId: string;
  orderId: string;
  orderReference: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  currency: string;
  transactionId: string | null;
  proofImageUrl: string;
  orderStatus: string;
  submittedAt: string;
};

export type AdminPaymentSettings = {
  shamCashAccountId: string;
  shamCashApiAccountId: string;
  shamCashAccountName: string;
  shamCashQrImageUrl: string | null;
  paymentInstructions: string;
  updatedAt: string;
};

export type AdminAuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  adminName: string;
};
