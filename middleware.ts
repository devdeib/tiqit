import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { resolveOrganizerAccess } from "@/lib/organizer-profile";

function apiErrorResponse(status: number, message: string) {
  return NextResponse.json(
    { error: { code: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", message } },
    { status },
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

  const isOrganizerPage = pathname.startsWith("/organizer");
  const isOrganizerApi = pathname.startsWith("/api/organizer");

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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/health|api/ready|api/webhooks|api/admin).*)",
  ],
};
