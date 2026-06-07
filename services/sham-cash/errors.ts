import type { ShamCashEndpointName } from "./endpoints";

export class ShamCashError extends Error {
  readonly provider = "sham_cash" as const;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ShamCashConfigurationError extends ShamCashError {
  readonly code = "SHAM_CASH_CONFIGURATION" as const;
  readonly missing: string;

  constructor(missing: string) {
    super(`Sham Cash is not configured: missing ${missing}`);
    this.name = "ShamCashConfigurationError";
    this.missing = missing;
  }
}

export class ShamCashEndpointNotConfiguredError extends ShamCashError {
  readonly code = "SHAM_CASH_ENDPOINT_NOT_CONFIGURED" as const;
  readonly endpointName: ShamCashEndpointName;

  constructor(endpointName: ShamCashEndpointName) {
    super(
      `Sham Cash API endpoint ${endpointName} is not configured — path missing from integration checklist`,
    );
    this.name = "ShamCashEndpointNotConfiguredError";
    this.endpointName = endpointName;
  }
}

export class ShamCashProviderError extends ShamCashError {
  readonly code = "SHAM_CASH_PROVIDER_ERROR" as const;
  readonly httpStatus: number;
  readonly providerCode?: string;
  readonly envelope: Record<string, unknown>;

  constructor(input: {
    message: string;
    httpStatus: number;
    providerCode?: string;
    envelope: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "ShamCashProviderError";
    this.httpStatus = input.httpStatus;
    this.providerCode = input.providerCode;
    this.envelope = input.envelope;
  }
}

export class ShamCashTimeoutError extends ShamCashError {
  readonly code = "SHAM_CASH_TIMEOUT" as const;
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Sham Cash API request timed out after ${timeoutMs}ms`);
    this.name = "ShamCashTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class ShamCashNetworkError extends ShamCashError {
  readonly code = "SHAM_CASH_NETWORK" as const;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ShamCashNetworkError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
