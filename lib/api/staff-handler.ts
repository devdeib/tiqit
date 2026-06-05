import { NextResponse } from "next/server";
import { jsonOk, jsonError, withApiHandler } from "@/lib/api/handler";
import { assertStaffMutationSafe } from "@/lib/staff-csrf";
import { requireStaffContext, type StaffContext } from "@/lib/staff-auth";
import { RATE_LIMITS, type RateLimitConfig } from "@/lib/rate-limit";
import type { RequestContext } from "@/lib/api/request-context";

type StaffHandler = (ctx: RequestContext, staff: StaffContext) => Promise<NextResponse>;

export function withStaffHandler(
  handler: StaffHandler,
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
        assertStaffMutationSafe(options.request);
      }
      const staff = await requireStaffContext();
      return handler(ctx, staff);
    },
    {
      request: options.request,
      route: options.route,
      rateLimit: options.rateLimit ?? RATE_LIMITS.staffWrite,
    },
  );
}

export function withStaffReadHandler(
  handler: StaffHandler,
  options: { request: Request; route: string },
): Promise<NextResponse> {
  return withStaffHandler(handler, {
    ...options,
    rateLimit: RATE_LIMITS.staffRead,
    requireMutationGuard: false,
  });
}

export function withStaffWriteHandler(
  handler: StaffHandler,
  options: { request: Request; route: string },
): Promise<NextResponse> {
  return withStaffHandler(handler, {
    ...options,
    rateLimit: RATE_LIMITS.staffWrite,
    requireMutationGuard: true,
  });
}

export { jsonOk, jsonError };
