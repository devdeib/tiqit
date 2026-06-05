import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { resolveOrganizerAccess } from "@/lib/organizer-profile";
import { resolveAdminAccess } from "@/lib/admin-profile";
import { resolveStaffAccess } from "@/lib/staff-profile";

const ADMIN_API_KEY_HEADER = "x-admin-api-key";

function apiErrorResponse(status: number, message: string) {
  return NextResponse.json(
    { error: { code: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", message } },
    { status },
  );
}

function isEmergencyAdminApi(pathname: string): boolean {
  return (
    pathname.includes("/resend-tickets") ||
    pathname.includes("/api/admin/reservations/")
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isStaffPage = pathname.startsWith("/staff");
  const isStaffApi = pathname.startsWith("/api/staff");
  const isOrganizerPage = pathname.startsWith("/organizer");
  const isOrganizerApi = pathname.startsWith("/api/organizer");

  if (isStaffPage || isStaffApi) {
    const access = await resolveStaffAccess(supabase);

    if (isStaffApi) {
      if (access === "anonymous") {
        return apiErrorResponse(401, "Staff authentication required");
      }
      if (access === "denied") {
        return apiErrorResponse(403, "Staff access denied");
      }
      return response;
    }

    if (pathname === "/staff/login") {
      if (access === "active") {
        const dest = request.nextUrl.clone();
        dest.pathname = "/staff";
        dest.search = "";
        return NextResponse.redirect(dest);
      }
      return response;
    }

    if (access !== "active") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/staff/login";
      loginUrl.searchParams.set("error", "access_denied");
      if (access === "anonymous") {
        loginUrl.searchParams.set("next", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  if (isAdminPage || isAdminApi) {
    if (
      isAdminApi &&
      (isEmergencyAdminApi(pathname) || request.headers.get(ADMIN_API_KEY_HEADER))
    ) {
      return response;
    }

    const access = await resolveAdminAccess(supabase);

    if (isAdminApi) {
      if (access === "anonymous") {
        return apiErrorResponse(401, "Admin authentication required");
      }
      if (access === "denied") {
        return apiErrorResponse(403, "Admin access denied");
      }
      return response;
    }

    if (pathname === "/admin/login") {
      if (access === "admin") {
        const dest = request.nextUrl.clone();
        dest.pathname = "/admin";
        dest.search = "";
        return NextResponse.redirect(dest);
      }
      return response;
    }

    if (access !== "admin") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("error", "access_denied");
      if (access === "anonymous") {
        loginUrl.searchParams.set("next", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  if (isOrganizerPage || isOrganizerApi || pathname === "/login") {
    const access = await resolveOrganizerAccess(supabase);

    if (isOrganizerApi) {
      if (access === "anonymous") {
        return apiErrorResponse(401, "Organizer authentication required");
      }
      if (access === "denied") {
        return apiErrorResponse(403, "Organizer account is not approved or not active");
      }
      return response;
    }

    if (isOrganizerPage) {
      if (access !== "approved") {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("error", "access_denied");
        if (access === "anonymous") {
          loginUrl.searchParams.set("next", pathname);
        }
        return NextResponse.redirect(loginUrl);
      }
      return response;
    }

    if (pathname === "/login" && access === "approved") {
      const dest = request.nextUrl.clone();
      dest.pathname = "/organizer";
      dest.search = "";
      return NextResponse.redirect(dest);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/health|api/ready|api/webhooks).*)",
  ],
};

