import { NextResponse } from "next/server";
import { jsonOk, jsonError, withApiHandler } from "@/lib/api/handler";
import { assertOrganizerMutationSafe } from "@/lib/organizer-csrf";
import { requireOrganizerContext, type OrganizerContext } from "@/lib/organizer-auth";
import { RATE_LIMITS, type RateLimitConfig } from "@/lib/rate-limit";
import type { RequestContext } from "@/lib/api/request-context";

type OrganizerHandler = (
  ctx: RequestContext,
  org: OrganizerContext,
) => Promise<NextResponse>;

export function withOrganizerHandler(
  handler: OrganizerHandler,
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
        assertOrganizerMutationSafe(options.request);
      }
      const org = await requireOrganizerContext();
      return handler(ctx, org);
    },
    {
      request: options.request,
      route: options.route,
      rateLimit: options.rateLimit ?? RATE_LIMITS.organizerWrite,
    },
  );
}

export function withOrganizerReadHandler(
  handler: OrganizerHandler,
  options: { request: Request; route: string },
): Promise<NextResponse> {
  return withOrganizerHandler(handler, {
    ...options,
    rateLimit: RATE_LIMITS.organizerRead,
    requireMutationGuard: false,
  });
}

export function withOrganizerWriteHandler(
  handler: OrganizerHandler,
  options: { request: Request; route: string },
): Promise<NextResponse> {
  return withOrganizerHandler(handler, {
    ...options,
    rateLimit: RATE_LIMITS.organizerWrite,
    requireMutationGuard: true,
  });
}

export { jsonOk, jsonError };
