const JSON_CONTENT_TYPE = "application/json";

export function buildShamCashAuthHeaders(apiToken: string): Record<string, string> {
  const token = apiToken.trim();
  if (!token) {
    throw new Error("Sham Cash API token must not be empty");
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: JSON_CONTENT_TYPE,
    "Content-Type": JSON_CONTENT_TYPE,
  };
}
