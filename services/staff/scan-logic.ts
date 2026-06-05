import type { StaffScanOutcome } from "@/types/staff";

/** Maps `validate_qr_scan` RPC return codes to API outcomes. */
export function mapValidateQrScanResult(code: string): StaffScanOutcome {
  switch (code) {
    case "VALID":
      return "valid";
    case "ALREADY_USED":
      return "already_used";
    case "WRONG_EVENT":
      return "wrong_event";
    case "VOIDED":
      return "voided";
    case "STAFF_NOT_AUTHORIZED":
      return "not_authorized";
    case "INVALID":
    default:
      return "invalid";
  }
}

export function scanOutcomeMessage(outcome: StaffScanOutcome): string {
  switch (outcome) {
    case "valid":
      return "Ticket accepted";
    case "already_used":
      return "Ticket already scanned";
    case "wrong_event":
      return "Ticket is for a different event";
    case "voided":
      return "Ticket has been voided";
    case "not_authorized":
      return "Not authorized for this event";
    case "invalid":
    default:
      return "Invalid ticket";
  }
}
