import type { EventStatus } from "@/types/database";

export type OrganizerEventSummary = {
  id: string;
  title: string;
  venue: string;
  eventDate: string;
  saleEndsAt: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerEventDetail = OrganizerEventSummary & {
  description: string | null;
  maxTicketsPerOrder: number;
  refundPolicyNote: string | null;
  approvedAt: string | null;
};

export type OrganizerTicketType = {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  price: number;
  totalCapacity: number;
  available: number;
  isActive: boolean;
};

export type OrganizerOrderRow = {
  id: string;
  status: string;
  totalAmount: number;
  ticketsIssued: boolean;
  createdAt: string;
  itemCount: number;
  ticketCount: number;
};

export type OrganizerEventAnalytics = {
  eventId: string;
  ordersTotal: number;
  ordersConfirmed: number;
  revenueConfirmed: number;
  ticketsSold: number;
  ticketsRemaining: number;
  byTicketType: Array<{
    ticketTypeId: string;
    name: string;
    sold: number;
    remaining: number;
    revenue: number;
  }>;
};

export type OrganizerStaffAssignment = {
  id: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  assignedAt: string;
};

export type OrganizerStaffOption = {
  id: string;
  fullName: string;
  email: string;
};

export type OrganizerDashboardStats = {
  eventsTotal: number;
  eventsDraft: number;
  eventsPendingApproval: number;
  eventsActive: number;
  eventsCompleted: number;
};
