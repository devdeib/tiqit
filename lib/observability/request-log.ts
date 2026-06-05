import "server-only";

import { logger } from "@/lib/logger";

export type RequestLogContext = {
  requestId: string;
  route?: string;
  method?: string;
  clientIp?: string;
  status?: number;
  durationMs?: number;
  code?: string;
};

export function logApiRequestStarted(context: RequestLogContext): void {
  logger.info("api_request_started", {
    event: "api_request_started",
    ...context,
  });
}

export function logApiRequestCompleted(context: RequestLogContext): void {
  logger.info("api_request_completed", {
    event: "api_request_completed",
    ...context,
  });
}
