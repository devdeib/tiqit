import type {
  ShamCashCreatePaymentRequest,
  ShamCashCreatePaymentResponse,
  ShamCashPaymentStatusResponse,
  ShamCashTransactionsListResponse,
} from "./api-types";
import { resolveShamCashApiBaseUrl } from "./config";
import { DEFAULT_SHAM_CASH_RETRY, DEFAULT_SHAM_CASH_TIMEOUT_MS } from "./constants";
import { requireShamCashEndpointPath } from "./endpoints";
import { ShamCashConfigurationError } from "./errors";
import { shamCashApiRequest } from "./request";
import type { RetryPolicy } from "../payments/retry";

export type ShamCashHttpClientDeps = {
  fetchImpl?: typeof fetch;
  getApiKey: () => string | undefined;
  getBaseUrl: () => string | undefined;
  timeoutMs?: number;
  retryPolicy?: RetryPolicy;
};

export class ShamCashHttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly getApiKey: () => string | undefined;
  private readonly getBaseUrl: () => string | undefined;
  private readonly timeoutMs: number;
  private readonly retryPolicy: RetryPolicy;

  constructor(deps: ShamCashHttpClientDeps) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.getApiKey = deps.getApiKey;
    this.getBaseUrl = deps.getBaseUrl;
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_SHAM_CASH_TIMEOUT_MS;
    this.retryPolicy = deps.retryPolicy ?? DEFAULT_SHAM_CASH_RETRY;
  }

  private resolveConfig(): { apiKey: string; baseUrl: string } {
    const apiKey = this.getApiKey()?.trim();
    if (!apiKey) {
      throw new ShamCashConfigurationError("SHAM_CASH_API_KEY");
    }

    return {
      apiKey,
      baseUrl: resolveShamCashApiBaseUrl(this.getBaseUrl()),
    };
  }

  async createPayment(
    request: ShamCashCreatePaymentRequest,
  ): Promise<ShamCashCreatePaymentResponse> {
    const { apiKey, baseUrl } = this.resolveConfig();
    const path = requireShamCashEndpointPath("CREATE_PAYMENT");

    const result = await shamCashApiRequest({
      method: "POST",
      path,
      body: request,
      apiToken: apiKey,
      baseUrl,
      fetchImpl: this.fetchImpl,
      timeoutMs: this.timeoutMs,
      retryPolicy: this.retryPolicy,
    });

    return {
      providerPaymentId: readString(result.raw.id) ?? readString(result.raw.payment_id) ?? "",
      redirectUrl: readString(result.raw.redirect_url) ?? readString(result.raw.checkout_url) ?? "",
      raw: result.raw,
    };
  }

  async getPaymentStatus(
    providerPaymentId: string,
  ): Promise<ShamCashPaymentStatusResponse> {
    const { apiKey, baseUrl } = this.resolveConfig();
    const pathTemplate = requireShamCashEndpointPath("GET_PAYMENT_STATUS");
    const path = pathTemplate.replace("{paymentId}", encodeURIComponent(providerPaymentId));

    const result = await shamCashApiRequest({
      method: "GET",
      path,
      apiToken: apiKey,
      baseUrl,
      fetchImpl: this.fetchImpl,
      timeoutMs: this.timeoutMs,
      retryPolicy: this.retryPolicy,
    });

    return {
      providerPaymentId,
      raw: result.raw,
    };
  }

  async listTransactions(): Promise<ShamCashTransactionsListResponse> {
    const { apiKey, baseUrl } = this.resolveConfig();
    const path = requireShamCashEndpointPath("LIST_TRANSACTIONS");

    const result = await shamCashApiRequest({
      method: "GET",
      path,
      apiToken: apiKey,
      baseUrl,
      fetchImpl: this.fetchImpl,
      timeoutMs: this.timeoutMs,
      retryPolicy: this.retryPolicy,
    });

    return {
      raw: result.raw,
    };
  }
}

export function createShamCashHttpClient(deps: ShamCashHttpClientDeps): ShamCashHttpClient {
  return new ShamCashHttpClient(deps);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
