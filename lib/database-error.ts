import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

type PostgrestError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export function databaseAppError(message: string, cause: unknown): AppError {
  const pg = (cause ?? {}) as PostgrestError;
  const pgDetails = {
    pgMessage: pg.message,
    pgCode: pg.code,
    pgDetails: pg.details,
    pgHint: pg.hint,
  };

  logger.error(message, pgDetails);

  return new AppError(message, {
    code: "DATABASE",
    cause,
    expose: false,
    details: pgDetails,
  });
}
