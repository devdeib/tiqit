export const LOGIN_FLASH = {
  organizer: {
    cookie: "tiqit_organizer_login_flash",
    sessionKey: "tiqit_organizer_login_flash",
    path: "/login",
  },
  admin: {
    cookie: "tiqit_admin_login_flash",
    sessionKey: "tiqit_admin_login_flash",
    path: "/admin/login",
  },
  staff: {
    cookie: "tiqit_staff_login_flash",
    sessionKey: "tiqit_staff_login_flash",
    path: "/staff/login",
  },
} as const;

export type LoginPortal = keyof typeof LOGIN_FLASH;

export const LOGIN_FLASH_ACCESS_DENIED = "access_denied" as const;

export type LoginFlashValue = typeof LOGIN_FLASH_ACCESS_DENIED;
