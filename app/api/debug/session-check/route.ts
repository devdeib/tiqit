import { jsonOk, withApiHandler } from "@/lib/api/handler";
import { getAdminContext } from "@/lib/admin-auth";
import { getOrganizerContext } from "@/lib/organizer-auth";

export const dynamic = "force-dynamic";

/**
 * Session + RLS diagnostic (no secrets). Use after login to debug events access.
 * GET /api/debug/session-check
 */
export async function GET() {
  return withApiHandler(async () => {
    const admin = await getAdminContext();
    const organizer = await getOrganizerContext();

    const result: Record<string, unknown> = {
      adminSession: admin ? { userId: admin.profile.id, role: admin.profile.role } : null,
      organizerSession: organizer
        ? {
            userId: organizer.profile.id,
            role: organizer.profile.role,
            organizerStatus: organizer.profile.organizer_status,
          }
        : null,
    };

    const client = admin?.supabase ?? organizer?.supabase;
    if (client) {
      const { data: usersProbe, error: usersError } = await client
        .from("users")
        .select("id, role")
        .limit(1);

      const { data: eventsProbe, error: eventsError } = await client
        .from("events")
        .select("id, title, status")
        .limit(3);

      result.usersProbe = {
        ok: !usersError,
        count: usersProbe?.length ?? 0,
        error: usersError?.message ?? null,
        code: usersError?.code ?? null,
      };
      result.eventsProbe = {
        ok: !eventsError,
        count: eventsProbe?.length ?? 0,
        error: eventsError?.message ?? null,
        code: eventsError?.code ?? null,
      };
    } else {
      result.error = "No admin or organizer session — sign in first, then call this URL in the same browser.";
    }

    return jsonOk(result);
  });
}
