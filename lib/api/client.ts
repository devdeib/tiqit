export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const message =
      (data as { error?: { message?: string } })?.error?.message ?? "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) {
    const message =
      (data as { error?: { message?: string } })?.error?.message ?? "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) {
    const message =
      (data as { error?: { message?: string } })?.error?.message ?? "Request failed";
    throw new Error(message);
  }
  return data as T;
}
