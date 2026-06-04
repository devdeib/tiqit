# Staging test playbook (Phase 1)

Run against your **Vercel Preview / staging** deployment and **staging Supabase** project.

**Prerequisites**

- Migrations applied (including `20250605-phase1-hardening-fulfillment.sql`)
- `supabase/seed-dev.sql` on staging (optional demo event)
- `GET /api/ready` returns `status: "ok"` and `deployment.ok: true`
- `ADMIN_API_SECRET` set in Vercel for emergency APIs

**Variables for curl** (replace):

```bash
export APP_URL="https://your-staging-app.vercel.app"
export PHONE="+963900000001"
export ADMIN_KEY="your-admin-api-secret"
```

Automated smoke: `npm run staging:audit` (requires `APP_URL` in environment).

---

## 1. Complete checkout (happy path)

| Step | Action | Expected |
|------|--------|----------|
| 1 | `GET $APP_URL/api/events` | `200`, at least one event |
| 2 | `POST $APP_URL/api/reservations` with guest + items | `201`, `reservationId` |
| 3 | Open `$APP_URL/checkout/{reservationId}` in browser | Checkout page |
| 4 | Pay → mock pay → simulate | Redirect to confirmation |
| 5 | `POST $APP_URL/api/orders/lookup` with `orderId` + `phone` | `200`, tickets array |

**Reservation body example:**

```json
{
  "eventId": "<event-uuid>",
  "items": [{ "ticketTypeId": "<type-uuid>", "quantity": 1 }],
  "guest": { "fullName": "Staging Guest", "phone": "+963900000001" }
}
```

---

## 2. Expired reservation (payment blocked)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create reservation (test 1) | `201` |
| 2 | In Supabase SQL: `UPDATE reservations SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = '<id>';` | — |
| 3 | Run `SELECT expire_stale_reservations();` OR wait for cron | `status = expired`, inventory released |
| 4 | `POST /api/checkout` with same `reservationId` + `phone` | `409` conflict (expired / no hold) |
| 5 | If order was created earlier, simulate webhook | `409` reservation not eligible |

**Admin release (alternative setup):**

```bash
curl -sS -X POST "$APP_URL/api/admin/reservations/<reservationId>/release" \
  -H "x-admin-api-key: $ADMIN_KEY"
```

---

## 3. Failed payment (recovery)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Complete checkout through order + pending payment | Pending payment row |
| 2 | POST webhook with `status: "failed"` (signed) | `200`, payment `failed` |
| 3 | `POST /api/checkout` again (same reservation if still pending, same idempotency key) | New **pending** payment or resume mock URL |
| 4 | Complete payment via mock simulate or success webhook | Order `confirmed`, tickets issued |

**Failed webhook body (mock signing — staging with secret):**

```json
{
  "event_id": "fail_evt_<unique>",
  "payment_id": "<provider_payment_id from payments table>",
  "status": "failed"
}
```

Sign: `sha256(rawBody + SHAM_CASH_WEBHOOK_SECRET)` → header `x-sham-cash-signature`.

---

## 4. Duplicate webhook (idempotency)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Complete a successful payment webhook once | `alreadyProcessed: false` |
| 2 | Replay **identical** body + same `event_id` | `200`, `alreadyProcessed: true` |
| 3 | Verify in DB: one `payment_webhook_events` row per `provider_event_id` | No duplicate tickets |
| 4 | Count tickets = sum of `order_items.quantity` | No over-issuance |

---

## Admin emergency APIs (no UI)

| Endpoint | Method | Header |
|----------|--------|--------|
| `/api/admin/orders/{orderId}` | GET | `x-admin-api-key` |
| `/api/admin/orders/{orderId}/resend-tickets` | POST | `x-admin-api-key` |
| `/api/admin/reservations/{id}/release` | POST | `x-admin-api-key` |

**Inspect order:**

```bash
curl -sS "$APP_URL/api/admin/orders/<orderId>" -H "x-admin-api-key: $ADMIN_KEY" | jq .
```

---

## Pass criteria

- [ ] `/api/health` and `/api/ready` OK on staging
- [ ] Complete checkout issues tickets
- [ ] Expired reservation cannot pay
- [ ] Failed payment can retry checkout
- [ ] Duplicate webhook does not double-fulfill
- [ ] Admin inspect returns order + payments + reservation snapshot
- [ ] `POST /api/dev/simulate-payment` returns **404** on production (or disabled without `ALLOW_DEV_PAYMENT`)
