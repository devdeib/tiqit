/**
 * Sham Cash HTTP request/response shapes.
 * Payment operation field mapping is deferred until endpoint paths are confirmed.
 */

export type ShamCashCreatePaymentRequest = {
  orderId: string;
  amount: number;
  currency: string;
  customerPhone: string;
  description: string;
  returnUrl?: string;
  cancelUrl?: string;
};

export type ShamCashCreatePaymentResponse = {
  providerPaymentId: string;
  redirectUrl: string;
  raw: Record<string, unknown>;
};

export type ShamCashPaymentStatusResponse = {
  providerPaymentId: string;
  raw: Record<string, unknown>;
};

export type ShamCashTransactionsListResponse = {
  raw: Record<string, unknown>;
  data: unknown;
  httpStatus: number;
};

export type ShamCashAccountsListResponse = {
  raw: Record<string, unknown>;
  data: unknown;
  httpStatus: number;
};

export type ShamCashListTransactionsQuery = {
  accountId: string;
  transactionIds?: string;
  startAt?: string;
  endAt?: string;
  coinId?: number;
  limit?: number;
};

export type ShamCashApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    detail?: string;
    type?: string;
  };
  message?: string;
  detail?: string;
  code?: string;
  error_code?: string;
  error_description?: string;
};
