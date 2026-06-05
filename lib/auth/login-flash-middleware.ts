import { NextResponse, type NextRequest } from "next/server";
import {
  LOGIN_FLASH,
  LOGIN_FLASH_ACCESS_DENIED,
  type LoginPortal,
} from "@/lib/auth/login-flash";

export function applyLoginFlashCookie(
  response: NextResponse,
  portal: LoginPortal,
): void {
  const { cookie, path } = LOGIN_FLASH[portal];
  response.cookies.set(cookie, LOGIN_FLASH_ACCESS_DENIED, {
    maxAge: 60,
    path,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function redirectToPortalLogin(
  request: NextRequest,
  portal: LoginPortal,
  returnPath: string,
  includeNext: boolean,
): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = LOGIN_FLASH[portal].path;
  loginUrl.search = "";
  if (includeNext) {
    loginUrl.searchParams.set("next", returnPath);
  }
  const response = NextResponse.redirect(loginUrl);
  applyLoginFlashCookie(response, portal);
  return response;
}
