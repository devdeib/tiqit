import "server-only";

import { AppError } from "@/lib/errors";
import { isShamCashMockMode } from "@/services/sham-cash";

/** Allows mock-pay → simulate-payment while payment provider is in mock mode (all envs in Phase 1). */
export function assertDevPaymentAllowed(): void {
  if (!isShamCashMockMode()) {
    throw new AppError("Simulate payment requires mock payment mode", {
      code: "CONFIG",
      status: 503,
      expose: true,
    });
  }
}
