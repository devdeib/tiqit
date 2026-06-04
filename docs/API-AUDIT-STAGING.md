# API audit — staging readiness (Phase 1)

## Route matrix

| Route | Auth / ownership | Service role | Validation | Rate limit |
|-------|------------------|--------------|------------|------------|
| `GET /api/health` | Public | Probe only | Env presence | — |
| `GET /api/ready` | Public | Probe + schema | Deployment rules | — |
| `GET /api/events` | Public read | Yes | Active events only | guest-read |
| `GET /api/events/[id]` | Public read | Yes | UUID + active | guest-read |
| `POST /api/reservations` | Open (abuse → RL) | Yes | Zod + DB RPC inventory | guest-write |
| `GET /api/reservations/[id]` | Guest phone query | Yes | Zod phone + ownership | guest-read |
| `POST /api/checkout` | Guest phone body | Yes | Zod + reservation state | guest-write |
| `GET /api/checkout/[id]/status` | Guest phone query | Yes | Ownership | guest-read |
| `POST /api/orders/lookup` | orderId + phone | Yes | Zod + ownership | guest-write |
| `POST /api/webhooks/sham-cash` | HMAC signature | Yes | Payload + payment row | webhook |
| `POST /api/dev/simulate-payment` | Phone + mock only | Yes | Blocked prod | guest-write |
| `GET /api/admin/orders/[id]` | `x-admin-api-key` | Yes | Admin secret | admin |
| `POST .../resend-tickets` | Admin secret | Yes | Order confirmed | admin |
| `POST .../reservations/[id]/release` | Admin secret | Yes | Not converted | admin |

## Findings addressed in this pass

- **Service role**: Still required for all guest writes (RLS deny on reservations/orders). Mitigated by phone ownership checks + rate limits.
- **Error responses**: `requestId` on all `withApiHandler` routes; structured JSON logs on Vercel.
- **Webhook**: Signature required in staging (non-mock) and production; request logging without storing raw body.
- **Mock payment**: `assertDevPaymentAllowed()` blocks production and non-mock staging.
- **Failed payments**: Checkout `resumeCheckout` creates new pending payment when previous failed.

## Residual risks (Phase 2+)

- Phone-only guest auth (no session/JWT).
- In-memory rate limits (per instance).
- Live Sham Cash `createSession` not implemented.
- No WAF / bot protection beyond basic RL.
