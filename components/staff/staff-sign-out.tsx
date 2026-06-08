"use client";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function StaffSignOut() {
  const router = useRouter();
  async function handleSignOut() {
    await createBrowserSupabaseClient().auth.signOut();
    router.push("/staff/login");
    router.refresh();
  }
  return (
    <button onClick={handleSignOut} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "10px", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tq-muted)", fontFamily: "inherit" }}>
      Sign out →
    </button>
  );
}
