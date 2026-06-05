export type StaffScanOutcome =
  | "valid"
  | "already_used"
  | "invalid"
  | "wrong_event"
  | "voided"
  | "not_authorized";

export type StaffAssignedEvent = {
  id: string;
  title: string;
  venue: string;
  eventDate: string;
  status: string;
  assignedAt: string;
};

export type StaffScanResult = {
  outcome: StaffScanOutcome;
  message: string;
  scannedAt: string | null;
  ticket: {
    id: string;
    holderName: string;
    ticketTypeName: string;
    status: string;
  } | null;
};

export type StaffEventStats = {
  eventId: string;
  totalTickets: number;
  scanned: number;
  remaining: number;
};
