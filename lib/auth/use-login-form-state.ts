"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LOGIN_FLASH,
  LOGIN_FLASH_ACCESS_DENIED,
  type LoginFlashValue,
  type LoginPortal,
} from "@/lib/auth/login-flash";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapeRegExp(name)}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function clearCookie(name: string, path: string): void {
  document.cookie = `${name}=; Path=${path}; Max-Age=0; SameSite=Lax`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Read once per visit from sessionStorage or short-lived flash cookie, then clear. */
function readAndClearLoginFlash(portal: LoginPortal): LoginFlashValue | null {
  const { cookie, sessionKey, path } = LOGIN_FLASH[portal];

  const sessionValue = sessionStorage.getItem(sessionKey);
  if (sessionValue === LOGIN_FLASH_ACCESS_DENIED) {
    sessionStorage.removeItem(sessionKey);
    clearCookie(cookie, path);
    return LOGIN_FLASH_ACCESS_DENIED;
  }

  const cookieValue = readCookie(cookie);
  if (cookieValue === LOGIN_FLASH_ACCESS_DENIED) {
    clearCookie(cookie, path);
    sessionStorage.removeItem(sessionKey);
    return LOGIN_FLASH_ACCESS_DENIED;
  }

  return null;
}

function stripLegacyErrorQueryParam(pathname: string, router: ReturnType<typeof useRouter>): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("error")) return;

  params.delete("error");
  const qs = params.toString();
  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
}

export function useLoginFormState(portal: LoginPortal) {
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    setError(null);
    stripLegacyErrorQueryParam(pathname, router);

    const flash = readAndClearLoginFlash(portal);
    setAccessDenied(flash === LOGIN_FLASH_ACCESS_DENIED);

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setError(null);
      }
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [pathname, portal, router]);

  function clearError() {
    setError(null);
  }

  return { error, setError, accessDenied, clearError };
}
