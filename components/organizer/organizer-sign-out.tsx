"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function OrganizerSignOut() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="tq-label transition-colors hover:text-white"
      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tq-muted)" }}
    >
      Sign out →
    </button>
  );
}
