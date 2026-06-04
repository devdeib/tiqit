import { AppError } from "@/lib/errors";

/** Must match lib/api/organizer-client.ts */
export const ORGANIZER_MUTATION_HEADER = "x-tiqit-organizer-request";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Same-origin + custom header check for organizer write APIs (browser fetch from portal).
 */
export function assertOrganizerMutationSafe(request: Request): void {
  const method = request.method.toUpperCase();
  if (!MUTATING_METHODS.has(method)) return;

  if (request.headers.get(ORGANIZER_MUTATION_HEADER) !== "1") {
    throw new AppError("Organizer request validation failed", {
      code: "FORBIDDEN",
      status: 403,
      expose: true,
    });
  }

  const host = request.headers.get("host");
  if (!host) {
    throw new AppError("Organizer request validation failed", {
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
      /* invalid origin */
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).host === host) return;
    } catch {
      /* invalid referer */
    }
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "none") {
    return;
  }

  throw new AppError("Cross-origin organizer requests are not allowed", {
    code: "FORBIDDEN",
    status: 403,
    expose: true,
  });
}
