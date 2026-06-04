export type ReservationItemInput = {
  ticketTypeId: string;
  quantity: number;
};

export type GuestInput = {
  fullName: string;
  phone: string;
  email?: string | null;
};

export type PublicEventSummary = {
  id: string;
  title: string;
  venue: string;
  eventDate: string;
  saleEndsAt: string;
  status: string;
};

export type PublicTicketType = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: number;
  isActive: boolean;
};

export type PublicEventDetail = PublicEventSummary & {
  description: string | null;
  maxTicketsPerOrder: number;
  ticketTypes: PublicTicketType[];
};

export type ReservationResponse = {
  reservationId: string;
  eventId: string;
  expiresAt: string;
  totalAmount: number;
  items: Array<{
    ticketTypeId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

export type CheckoutResponse = {
  orderId: string;
  paymentId: string;
  totalAmount: number;
  redirectUrl: string;
  mockMode: boolean;
};

export type CheckoutStatusResponse = {
  orderId: string;
  orderStatus: string;
  paymentStatus: string;
  ticketsIssued: boolean;
  ticketCount: number;
};

export type OrderConfirmationResponse = {
  orderId: string;
  eventId: string;
  eventTitle: string;
  totalAmount: number;
  status: string;
  tickets: Array<{
    id: string;
    token: string;
    qrPayload: string;
    holderName: string;
    ticketTypeName: string;
  }>;
};
