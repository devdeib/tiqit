/**
 * Optional Supabase Edge Function mirror of POST /api/webhooks/sham-cash.
 * Prefer the Next.js route for Vercel deployments unless you need edge-only webhooks.
 *
 * Deploy: supabase functions deploy sham-cash-webhook
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const appUrl = Deno.env.get("APP_URL");
  if (!appUrl) {
    return new Response("APP_URL not configured", { status: 500 });
  }

  const rawBody = await req.text();
  const res = await fetch(`${appUrl}/api/webhooks/sham-cash`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sham-cash-signature": req.headers.get("x-sham-cash-signature") ?? "",
    },
    body: rawBody,
  });

  return new Response(await res.text(), { status: res.status });
});
