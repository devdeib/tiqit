import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createRequestContext, type RequestContext } from "@/lib/api/request-context";
import { AppError, isAppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  logApiRequestCompleted,
  logApiRequestStarted,
} from "@/lib/observability/request-log";
import { reportProductionError } from "@/lib/observability/error-report";
import {
  checkRateLimit,
  clientIpFromRequest,
  type RateLimitConfig,
} from "@/lib/rate-limit";

export function jsonOk<T>(
  data: T,
  status = 200,
  headers?: Record<string, string>,
) {
  return NextResponse.json(data, { status, headers });
}

export function jsonError(error: AppError, requestId?: string) {
  const body = error.toJSON(requestId);
  return NextResponse.json(body, {
    status: error.status,
    headers: requestId ? { "x-request-id": requestId } : undefined,
  });
}

export function withApiHandler(
  handler: (ctx: RequestContext) => Promise<NextResponse>,
  options?: {
    request?: Request;
    route?: string;
    rateLimit?: RateLimitConfig;
    logClientErrors?: boolean;
  },
): Promise<NextResponse> {
  const started = Date.now();
  const ctx = options?.request
    ? createRequestContext(options.request, options.route)
    : { requestId: randomUUID(), route: options?.route };

  if (options?.request && options.rateLimit) {
    const ip = clientIpFromRequest(options.request);
    ctx.clientIp = ip;
    try {
      checkRateLimit(options.rateLimit, ip);
    } catch (err) {
      if (isAppError(err)) return Promise.resolve(jsonError(err, ctx.requestId));
      throw err;
    }
  }

  logApiRequestStarted({
    requestId: ctx.requestId,
    route: ctx.route,
    method: ctx.method,
    clientIp: ctx.clientIp,
  });

  return handler(ctx)
    .then((response) => {
      response.headers.set("x-request-id", ctx.requestId);
      logApiRequestCompleted({
        requestId: ctx.requestId,
        route: ctx.route,
        method: ctx.method,
        clientIp: ctx.clientIp,
        status: response.status,
        durationMs: Date.now() - started,
      });
      return response;
    })
    .catch((err: unknown) => {
      const appError = isAppError(err) ? err : toAppError(err);
      const logCtx = {
        requestId: ctx.requestId,
        route: ctx.route,
        method: ctx.method,
        clientIp: ctx.clientIp,
        code: appError.code,
        status: appError.status,
        message: appError.message,
        durationMs: Date.now() - started,
      };

      if (appError.status >= 500) {
        reportProductionError(appError, logCtx);
      } else if (options?.logClientErrors !== false && appError.status >= 400) {
        logger.warn("api_request_rejected", logCtx);
      }

      logApiRequestCompleted({
        requestId: ctx.requestId,
        route: ctx.route,
        method: ctx.method,
        clientIp: ctx.clientIp,
        status: appError.status,
        durationMs: Date.now() - started,
        code: appError.code,
      });

      return jsonError(appError, ctx.requestId);
    });
}
