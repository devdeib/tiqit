# Sham Cash integration checklist

Phase 6.2 prepared the HTTP client, Bearer auth, timeout/retry, and structured errors.
Live checkout remains disabled until every item below is confirmed and implemented.

## Documented (implemented)

| Item | Status | Location |
|------|--------|----------|
| API base URL | `https://api.shamcash-api.com/v1` | `services/sham-cash/constants.ts`, override via `SHAM_CASH_API_BASE_URL` |
| Authentication | `Authorization: Bearer <api_token>` | `services/sham-cash/auth.ts` |
| HTTP timeout | 15s default | `services/sham-cash/constants.ts` |
| Retry policy | 3 attempts, exponential backoff | `services/sham-cash/request.ts` + `services/payments/retry.ts` |
| Error envelope parsing | JSON `error.message`, `error.code`, top-level fallbacks | `services/sham-cash/parse-error.ts` |

## Missing — block live checkout

### 1. Create payment endpoint

- [x] **Not applicable** — Sham Cash has no create-payment API
- [x] Guest pays manually with `reference_code` in payment note (`TIQIT-XXXXXXXX`)
- [ ] Optional: in-app payment instructions UI on `/checkout/redirect`

### 2. Payment status endpoint

- [x] **Replaced by transaction verification** — Sham Cash has no payment status API
- [x] Use `GET /transactions` via `services/sham-cash/transaction-matcher.ts`
- [x] Match `note === reference_code`, verify amount + currency
- [x] Confirm via `POST /api/checkout/[orderId]/verify-payment`

### 3. Redirect flow

- [ ] Return URL / cancel URL parameter names for create-payment request
- [ ] Customer redirect URL after payment initiation
- [ ] Return/callback page in app (`/checkout/redirect` — not yet implemented)
- [ ] Wire poll sync or webhook into checkout status API (Phase 6.3)

### 4. Webhook specification

- [ ] Whether Sham Cash sends payment webhooks
- [ ] Webhook URL registration process
- [ ] Signature header name and HMAC algorithm
- [ ] Event payload schema (`event_id`, `payment_id`, `status`, …)
- [ ] Set `SHAM_CASH_WEBHOOK_SECRET` only after signature format is confirmed

## Environment variables

| Variable | Required for live | Notes |
|----------|-------------------|-------|
| `SHAM_CASH_API_KEY` | Yes | Bearer token |
| `SHAM_CASH_API_BASE_URL` | No | Defaults to documented v1 base URL |
| `SHAM_CASH_FORCE_LIVE` | Yes (`true`) | Live mode **off** by default |
| `SHAM_CASH_MOCK` | No | `true` forces mock even if live flags set |
| `SHAM_CASH_WEBHOOK_SECRET` | No | Enables webhook confirmation mode when set |

## Enabling live mode (after checklist complete)

1. Fill endpoint paths in `services/sham-cash/endpoints.ts`
2. Implement response mappers in `map-response.ts`
3. Set `SHAM_CASH_API_KEY` and `SHAM_CASH_FORCE_LIVE=true`
4. Verify create → redirect → status poll → fulfillment in staging
5. Do **not** enable in production until redirect + confirmation paths are tested end-to-end
