import { randomUUID } from "crypto";

export type RequestContext = {
  requestId: string;
  route?: string;
  method?: string;
  clientIp?: string;
};

export function createRequestContext(
  request: Request,
  route?: string,
): RequestContext {
  const incoming = request.headers.get("x-request-id");
  return {
    requestId: incoming?.trim() || randomUUID(),
    route,
    method: request.method,
    clientIp: undefined,
  };
}
