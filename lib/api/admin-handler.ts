import { NextResponse } from "next/server";
import { jsonOk, jsonError, withApiHandler } from "@/lib/api/handler";
import { assertAdminMutationSafe } from "@/lib/admin-csrf";
import { requireAdminContext, type AdminContext } from "@/lib/admin-auth";
import { RATE_LIMITS, type RateLimitConfig } from "@/lib/rate-limit";
import type { RequestContext } from "@/lib/api/request-context";

type AdminHandler = (ctx: RequestContext, admin: AdminContext) => Promise<NextResponse>;

export function withAdminHandler(
  handler: AdminHandler,
  options: {
    request: Request;
    route: string;
    rateLimit?: RateLimitConfig;
    requireMutationGuard?: boolean;
  },
): Promise<NextResponse> {
  return withApiHandler(
    async (ctx) => {
      if (options.requireMutationGuard) {
        assertAdminMutationSafe(options.request);
      }
      const admin = await requireAdminContext();
      return handler(ctx, admin);
    },
    {
      request: options.request,
      route: options.route,
      rateLimit: options.rateLimit ?? RATE_LIMITS.adminWrite,
    },
  );
}

export function withAdminReadHandler(
  handler: AdminHandler,
  options: { request: Request; route: string },
): Promise<NextResponse> {
  return withAdminHandler(handler, {
    ...options,
    rateLimit: RATE_LIMITS.adminRead,
    requireMutationGuard: false,
  });
}

export function withAdminWriteHandler(
  handler: AdminHandler,
  options: { request: Request; route: string },
): Promise<NextResponse> {
  return withAdminHandler(handler, {
    ...options,
    rateLimit: RATE_LIMITS.adminWrite,
    requireMutationGuard: true,
  });
}

export { jsonOk, jsonError };
