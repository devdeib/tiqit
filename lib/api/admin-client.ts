import { ADMIN_MUTATION_HEADER } from "@/lib/admin-csrf";

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD";

  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(isMutation ? { [ADMIN_MUTATION_HEADER]: "1" } : {}),
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

export async function adminFetchForm<T>(path: string, form: FormData, method = "POST"): Promise<T> {
  const res = await fetch(path, {
    method,
    body: form,
    headers: { [ADMIN_MUTATION_HEADER]: "1" },
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
