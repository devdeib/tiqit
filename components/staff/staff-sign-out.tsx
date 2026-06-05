"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function StaffSignOut() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/staff/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleSignOut} className="text-sm text-neutral-600 underline">
      Sign out
    </button>
  );
}
