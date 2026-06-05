import { AppError } from "@/lib/errors";

export const STAFF_MUTATION_HEADER = "x-tiqit-staff-request";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function assertStaffMutationSafe(request: Request): void {
  const method = request.method.toUpperCase();
  if (!MUTATING_METHODS.has(method)) return;

  if (request.headers.get(STAFF_MUTATION_HEADER) !== "1") {
    throw new AppError("Staff request validation failed", {
      code: "FORBIDDEN",
      status: 403,
      expose: true,
    });
  }

  const host = request.headers.get("host");
  if (!host) {
    throw new AppError("Staff request validation failed", {
      code: "FORBIDDEN",
      status: 403,
      expose: true,
    });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host === host) return;
    } catch {
      /* invalid */
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).host === host) return;
    } catch {
      /* invalid */
    }
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "none") {
    return;
  }

  throw new AppError("Cross-origin staff requests are not allowed", {
    code: "FORBIDDEN",
    status: 403,
    expose: true,
  });
}
