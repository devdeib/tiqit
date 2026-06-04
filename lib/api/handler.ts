import { NextResponse } from "next/server";
import { AppError, isAppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(error: AppError) {
  return NextResponse.json(error.toJSON(), { status: error.status });
}

export function withApiHandler<T>(
  handler: () => Promise<NextResponse>,
  context?: Record<string, unknown>,
): Promise<NextResponse> {
  return handler().catch((err: unknown) => {
    const appError = isAppError(err) ? err : toAppError(err);
    if (appError.status >= 500) {
      logger.error("API handler error", { ...context, message: appError.message });
    }
    return jsonError(appError);
  });
}
