import { ShamCashEndpointNotConfiguredError } from "./errors";

/** Sham Cash API operations — only documented paths are registered here. */
export type ShamCashEndpointName =
  | "CREATE_PAYMENT"
  | "GET_PAYMENT_STATUS"
  | "LIST_TRANSACTIONS";

const ENDPOINT_PATHS: Record<ShamCashEndpointName, string | null> = {
  CREATE_PAYMENT: null,
  GET_PAYMENT_STATUS: null,
  LIST_TRANSACTIONS: "/transactions",
};

export function getShamCashEndpointPath(name: ShamCashEndpointName): string | null {
  return ENDPOINT_PATHS[name];
}

export function requireShamCashEndpointPath(name: ShamCashEndpointName): string {
  const path = ENDPOINT_PATHS[name];
  if (!path) {
    throw new ShamCashEndpointNotConfiguredError(name);
  }
  return path;
}
