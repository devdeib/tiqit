import type { AdminContext } from "@/lib/admin-auth";
import type { Json } from "@/types/database";

export async function logAdminAction(
  admin: AdminContext,
  input: {
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.supabase.from("admin_audit_logs").insert({
    admin_id: admin.profile.id,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: (input.metadata ?? null) as Json,
  });

  if (error) {
    console.error("admin_audit_log_failed", error.message);
  }
}
