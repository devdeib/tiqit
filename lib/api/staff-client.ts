import { STAFF_MUTATION_HEADER } from "@/lib/staff-csrf";

export async function staffFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD";

  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(isMutation ? { [STAFF_MUTATION_HEADER]: "1" } : {}),
      ...init?.headers,
    },
    credentials: "same-origin",
  });

  const data = await res.json();
  if (!res.ok) {
    const message =
      (data as { error?: { message?: string } })?.error?.message ?? "Request failed";
    throw new Error(message);
  }
  return data as T;
}
