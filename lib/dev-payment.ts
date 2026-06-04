import "server-only";

import { getAppEnvironment, isProductionDeploy } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { isShamCashMockMode } from "@/services/sham-cash";

export function assertDevPaymentAllowed(): void {
  if (isProductionDeploy() && process.env.ALLOW_DEV_PAYMENT !== "true") {
    throw new AppError("Not found", { code: "NOT_FOUND", status: 404, expose: false });
  }

  const appEnv = getAppEnvironment();
  if (appEnv === "production" && process.env.SHAM_CASH_MOCK === "true") {
    throw new AppError("Mock payments are disabled in production", {
      code: "FORBIDDEN",
      status: 403,
      expose: false,
    });
  }

  if (!isShamCashMockMode()) {
    throw new AppError("Simulate payment requires mock payment mode", {
      code: "CONFIG",
      status: 503,
      expose: true,
    });
  }
}
