"use client";

import { TicketQr } from "./ticket-qr";

type Props = {
  ticketId: string;
  holderName: string;
  phone: string;
  eventTitle: string;
  venue: string;
  eventDate: string;
  ticketType: string;
  section?: string;
  row?: string;
  seat?: string;
  qrValue: string;
  isVip?: boolean;
};

export function TicketCard({
  holderName,
  phone,
  eventTitle,
  venue,
  eventDate,
  ticketType,
  section,
  row,
  seat,
  qrValue,
  isVip = false,
}: Props) {
  const accentColor = isVip ? "var(--tq-gold)" : "var(--tq-pink)";
  const tierBg      = isVip ? "rgba(212,168,67,0.15)" : "rgba(139,47,232,0.2)";
  const tierColor   = isVip ? "var(--tq-gold)" : "var(--tq-purple-lt)";

  return (
    <div
      className="ticket-card overflow-hidden rounded-xl"
      style={{
        background: "var(--tq-panel)",
        border: "1px solid var(--tq-rule)",
        fontFamily: "var(--font-geist-sans), 'Helvetica Neue', sans-serif",
      }}
    >
      {/* Top accent */}
      <div style={{ height: "3px", background: accentColor }} />

      <div className="flex flex-col sm:flex-row">
        {/* ── LEFT: Event info ─────────────────────────── */}
        <div className="flex-1 p-6">
          {/* Logo + tier */}
          <div className="mb-5 flex items-center justify-between">
            <span
              style={{
                fontWeight: 900,
                fontSize: "16px",
                letterSpacing: "-0.04em",
                color: "var(--tq-white)",
              }}
            >
              tiqit
            </span>
            <span
              className="tq-badge"
              style={{ background: tierBg, color: tierColor }}
            >
              {isVip ? "VIP Access" : "General"}
            </span>
          </div>

          {/* Event name */}
          <h2
            style={{
              fontWeight: 900,
              fontSize: "22px",
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              color: "var(--tq-white)",
              marginBottom: "4px",
            }}
          >
            {eventTitle}
          </h2>

          {/* Date + venue */}
          <div className="mb-5 space-y-1">
            <p style={{ fontSize: "13px", color: "var(--tq-off)" }}>{venue}</p>
            <p style={{ fontSize: "11px", letterSpacing: "0.06em", color: "var(--tq-muted)", textTransform: "uppercase" }}>
              {new Date(eventDate).toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric", year: "numeric",
              })}
              {" · "}
              {new Date(eventDate).toLocaleTimeString("en-US", {
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "var(--tq-rule)", marginBottom: "16px" }} />

          {/* Holder details grid */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ticket holder" value={holderName} />
            <Field label="Phone" value={phone} />
            <Field label="Ticket type" value={ticketType} accent={accentColor} />
            {(section || row || seat) && (
              <Field label="Seat" value={[section, row, seat].filter(Boolean).join(" · ")} />
            )}
          </div>
        </div>

        {/* ── Perforation ─────────────────────────────── */}
        <div
          className="flex flex-row sm:flex-col items-center justify-center"
          style={{ position: "relative" }}
        >
          {/* Notch top (left on mobile) */}
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "var(--tq-void)",
              flexShrink: 0,
            }}
          />
          {/* Dashed line */}
          <div
            style={{
              flex: 1,
              borderLeft: "2px dashed var(--tq-sub)",
              borderTop: "none",
              margin: "4px 0",
            }}
            className="hidden sm:block"
          />
          <div
            style={{
              flex: 1,
              borderTop: "2px dashed var(--tq-sub)",
              borderLeft: "none",
              margin: "0 4px",
            }}
            className="block sm:hidden"
          />
          {/* Notch bottom (right on mobile) */}
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "var(--tq-void)",
              flexShrink: 0,
            }}
          />
        </div>

        {/* ── RIGHT: QR stub ──────────────────────────── */}
        <div
          className="flex flex-col items-center justify-center gap-4 p-6"
          style={{
            background: "var(--tq-base)",
            minWidth: "180px",
          }}
        >
          <TicketQr value={qrValue} size={130} vip={isVip} />
          <p
            style={{
              fontSize: "9px",
              letterSpacing: "0.1em",
              color: "var(--tq-muted)",
              textTransform: "uppercase",
            }}
          >
            Scan to verify
          </p>
          {/* Barcode strip */}
          <div
            style={{
              width: "130px",
              height: "24px",
              borderRadius: "4px",
              background: "var(--tq-void)",
              display: "flex",
              alignItems: "center",
              gap: "2px",
              padding: "4px 8px",
              overflow: "hidden",
            }}
          >
            {Array.from({ length: 32 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: `${8 + (i % 3) * 4}px`,
                  width: i % 3 === 1 ? "2px" : "1px",
                  background: isVip ? "var(--tq-gold)" : "var(--tq-white)",
                  opacity: 0.9,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <p style={{ fontSize: "9px", letterSpacing: "0.1em", color: "var(--tq-muted)", textTransform: "uppercase", marginBottom: "3px" }}>
        {label}
      </p>
      <p
        style={{
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: accent ?? "var(--tq-off)",
        }}
      >
        {value}
      </p>
    </div>
  );
}
