type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function useStructuredLogs(): boolean {
  return (
    process.env.LOG_FORMAT === "json" ||
    process.env.APP_ENV === "staging" ||
    process.env.APP_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  );
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const base = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    service: "ticketing-platform",
    ...context,
  };

  if (useStructuredLogs()) {
    const line = JSON.stringify(base);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  const suffix =
    context && Object.keys(context).length > 0
      ? ` ${JSON.stringify(context)}`
      : "";
  const payload = `[ticketing] ${level.toUpperCase()} ${message}${suffix}`;
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else if (level === "debug") console.debug(payload);
  else console.info(payload);
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};
