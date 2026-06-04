# Supabase Edge Functions

Optional Deno functions. **For Vercel-hosted apps, use the Next.js webhook directly:**

`POST https://<APP_URL>/api/webhooks/sham-cash`

## sham-cash-webhook (proxy)

Forwards the raw body and `x-sham-cash-signature` to the Next.js route. Requires Edge secret `APP_URL` (same as Vercel `APP_URL`).

```bash
supabase secrets set APP_URL=https://your-app.vercel.app
supabase functions deploy sham-cash-webhook
```

Prefer registering Sham Cash against the Vercel URL unless you need Edge-only ingress.
