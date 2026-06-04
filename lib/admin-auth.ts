import "server-only";

import { timingSafeEqual } from "crypto";
import { AppError } from "@/lib/errors";
const ADMIN_HEADER = "x-admin-api-key";

export function assertAdminApiKey(request: Request): void {
  const configured = process.env.ADMIN_API_SECRET?.trim();
  if (!configured || configured.length < 16) {
    throw new AppError("Admin API is not configured", {
      code: "CONFIG",
      status: 503,
      expose: false,
    });
  }

  const provided = request.headers.get(ADMIN_HEADER)?.trim();
  if (!provided) {
    throw new AppError("Unauthorized", { code: "UNAUTHORIZED", status: 401, expose: false });
  }

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(configured, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("Unauthorized", { code: "UNAUTHORIZED", status: 401, expose: false });
  }
}

export function isAdminApiConfigured(): boolean {
  try {
    const secret = process.env.ADMIN_API_SECRET?.trim();
    return Boolean(secret && secret.length >= 16);
  } catch {
    return false;
  }
}

/** For deployment checks only */
export function adminSecretConfigured(): boolean {
  return Boolean(process.env.ADMIN_API_SECRET?.trim());
}
