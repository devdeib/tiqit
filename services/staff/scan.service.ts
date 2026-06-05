import { AppError } from "@/lib/errors";
import { parseQrInput, verifyTicketToken } from "@/lib/crypto/ticket-token";
import {
  assertStaffAssignedToEvent,
  type StaffContext,
} from "@/lib/staff-auth";
import type { StaffEventStats, StaffScanResult } from "@/types/staff";
import { mapValidateQrScanResult, scanOutcomeMessage } from "@/services/staff/scan-logic";

export async function scanStaffQr(
  staff: StaffContext,
  eventId: string,
  qrInput: string,
): Promise<StaffScanResult> {
  await assertStaffAssignedToEvent(staff, eventId);

  const parsed = parseQrInput(qrInput);
  if (!parsed) {
    return {
      outcome: "invalid",
      message: scanOutcomeMessage("invalid"),
      scannedAt: null,
      ticket: null,
    };
  }

  if (parsed.signature) {
    if (!verifyTicketToken(parsed.token, parsed.signature, parsed.keyVersion)) {
      return {
        outcome: "invalid",
        message: "Invalid QR signature",
        scannedAt: null,
        ticket: null,
      };
    }
  } else {
    const { data: ticketRow } = await staff.supabase
      .from("tickets")
      .select("hmac_signature, hmac_key_version, event_id")
      .eq("token", parsed.token)
      .maybeSingle();

    if (
      !ticketRow ||
      !verifyTicketToken(
        parsed.token,
        ticketRow.hmac_signature,
        ticketRow.hmac_key_version,
      )
    ) {
      return {
        outcome: "invalid",
        message: "Invalid QR signature",
        scannedAt: null,
        ticket: null,
      };
    }
  }

  const { data: rpcResult, error } = await staff.supabase.rpc("validate_qr_scan", {
    p_token: parsed.token,
    p_event_id: eventId,
  });

  if (error) {
    throw new AppError("Scan validation failed", { code: "DATABASE", cause: error });
  }

  const outcome = mapValidateQrScanResult(String(rpcResult ?? "INVALID"));
  const ticket = await loadTicketSummary(staff, parsed.token, eventId);

  return {
    outcome,
    message: scanOutcomeMessage(outcome),
    scannedAt: outcome === "valid" ? new Date().toISOString() : ticket?.scannedAt ?? null,
    ticket:
      ticket && (outcome === "valid" || outcome === "already_used")
        ? {
            id: ticket.id,
            holderName: ticket.holderName,
            ticketTypeName: ticket.ticketTypeName,
            status: ticket.status,
          }
        : null,
  };
}

export async function getStaffEventStats(
  staff: StaffContext,
  eventId: string,
): Promise<StaffEventStats> {
  await assertStaffAssignedToEvent(staff, eventId);

  const { count: totalTickets } = await staff.supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .in("status", ["confirmed", "used"]);

  const { count: scanned } = await staff.supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "used");

  const total = totalTickets ?? 0;
  const scannedCount = scanned ?? 0;

  return {
    eventId,
    totalTickets: total,
    scanned: scannedCount,
    remaining: Math.max(0, total - scannedCount),
  };
}

async function loadTicketSummary(
  staff: StaffContext,
  token: string,
  eventId: string,
): Promise<{
  id: string;
  holderName: string;
  ticketTypeName: string;
  status: string;
  scannedAt: string | null;
} | null> {
  const { data: ticket } = await staff.supabase
    .from("tickets")
    .select("id, holder_name, status, scanned_at, ticket_type_id")
    .eq("token", token)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!ticket) return null;

  const { data: ticketType } = await staff.supabase
    .from("ticket_types")
    .select("name")
    .eq("id", ticket.ticket_type_id)
    .maybeSingle();

  return {
    id: ticket.id,
    holderName: ticket.holder_name,
    ticketTypeName: ticketType?.name ?? "Ticket",
    status: ticket.status,
    scannedAt: ticket.scanned_at,
  };
}
