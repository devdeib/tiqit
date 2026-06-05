"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Keeps login errors scoped to the current visit. Clears stale client state when
 * the login route is entered again and moves one-time URL errors into memory.
 */
export function useLoginFormState() {
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    setError(null);
    setAccessDenied(false);

    const params = new URLSearchParams(window.location.search);
    const denied = params.get("error") === "access_denied";
    if (denied) {
      setAccessDenied(true);
      params.delete("error");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setError(null);
      }
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [pathname, router]);

  function clearError() {
    setError(null);
  }

  return { error, setError, accessDenied, clearError };
}
