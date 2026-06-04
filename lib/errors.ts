export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "EXTERNAL_SERVICE"
  | "DATABASE"
  | "CONFIG"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly expose: boolean;

  constructor(
    message: string,
    options: {
      code: ErrorCode;
      status?: number;
      details?: Record<string, unknown>;
      expose?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status ?? statusForCode(options.code);
    this.details = options.details;
    this.expose =
      options.expose ?? (options.status !== undefined && options.status < 500);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.expose ? this.message : "An unexpected error occurred",
        details: this.expose ? this.details : undefined,
      },
    };
  }
}

function statusForCode(code: ErrorCode): number {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "CONFIG":
      return 503;
    case "EXTERNAL_SERVICE":
    case "DATABASE":
      return 502;
    default:
      return 500;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toAppError(error: unknown, fallbackMessage = "Internal error"): AppError {
  if (isAppError(error)) return error;
  if (error instanceof Error) {
    return new AppError(error.message || fallbackMessage, {
      code: "INTERNAL",
      status: 500,
      expose: false,
      cause: error,
    });
  }
  return new AppError(fallbackMessage, { code: "INTERNAL", status: 500, expose: false, cause: error });
}
