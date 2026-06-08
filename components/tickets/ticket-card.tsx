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
  ticketId,
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
  const accent      = isVip ? "#D4A843" : "#F72585";
  const tierBg      = isVip ? "rgba(212,168,67,.15)"  : "rgba(139,47,232,.2)";
  const tierColor   = isVip ? "#D4A843"               : "#A855F7";
  const typeLabel   = isVip ? "VIP Access"            : "General Admission";

  const dateObj = new Date(eventDate);
  const dateStr = isNaN(dateObj.getTime())
    ? eventDate
    : dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const timeStr = isNaN(dateObj.getTime())
    ? ""
    : dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const seatStr = [section, row, seat].filter(Boolean).join(" · ");
  const shortId = ticketId.slice(0, 8).toUpperCase();

  return (
    <div
      className="ticket-card"
      style={{
        background: "var(--tq-panel)",
        border: "1px solid var(--tq-rule)",
        borderRadius: "14px",
        overflow: "hidden",
        fontFamily: "var(--font-geist-sans), 'Helvetica Neue', sans-serif",
        boxShadow: isVip
          ? "0 0 40px rgba(212,168,67,.08)"
          : "0 0 40px rgba(139,47,232,.06)",
      }}
    >
      {/* Top accent edge */}
      <div style={{ height: "3px", background: accent }} />

      <div style={{ display: "flex", flexDirection: "row" }}>

        {/* ── LEFT: Event info ── */}
        <div style={{ flex: 1, padding: "24px", minWidth: 0 }}>

          {/* Logo + tier badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <span style={{
              fontWeight: 900,
              fontSize: "15px",
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}>
              <span style={{ color: "#fafafa" }}>tiq</span>
              <span style={{ color: "#F72585" }}>it</span>
            </span>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: "9999px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              background: tierBg,
              color: tierColor,
            }}>
              {typeLabel}
            </span>
          </div>

          {/* Event title */}
          <h2 style={{
            fontWeight: 900,
            fontSize: "22px",
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
            color: isVip ? "#D4A843" : "#fafafa",
            marginBottom: "6px",
          }}>
            {eventTitle}
          </h2>

          {/* Venue + datetime */}
          {venue && (
            <p style={{ fontSize: "13px", color: "var(--tq-off)", marginBottom: "3px" }}>{venue}</p>
          )}
          {dateStr && (
            <p style={{
              fontSize: "10px",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--tq-muted)",
              marginBottom: "18px",
            }}>
              {dateStr}{timeStr ? ` · ${timeStr}` : ""}
            </p>
          )}

          {/* Divider */}
          <div style={{ height: "1px", background: "var(--tq-rule)", marginBottom: "18px" }} />

          {/* Holder info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <Field label="Ticket holder" value={holderName} />
            <Field label="Phone" value={phone} />
            <Field label="Ticket type" value={ticketType || typeLabel} accent={accent} />
            {seatStr
              ? <Field label="Seat" value={seatStr} />
              : isVip
                ? <Field label="Perks" value="Backstage · Lounge" accent={accent} />
                : null
            }
          </div>

          {/* Ticket ID */}
          <p style={{
            marginTop: "18px",
            fontSize: "9px",
            letterSpacing: ".1em",
            color: "var(--tq-sub)",
            fontFamily: "var(--font-geist-mono), monospace",
          }}>
            TQ-{shortId} · ADMIT ONE
          </p>
        </div>

        {/* ── Perforation ── */}
        <div style={{
          width: "26px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexShrink: 0,
          position: "relative",
        }}>
          {/* Top notch */}
          <div style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            background: "var(--tq-void)",
            flexShrink: 0,
            marginTop: "-1px",
          }} />
          {/* Dashed line */}
          <div style={{
            flex: 1,
            borderLeft: "2px dashed var(--tq-sub)",
          }} />
          {/* Bottom notch */}
          <div style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            background: "var(--tq-void)",
            flexShrink: 0,
            marginBottom: "-1px",
          }} />
        </div>

        {/* ── RIGHT: QR stub ── */}
        <div style={{
          width: "196px",
          background: "var(--tq-base)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "24px 20px",
          flexShrink: 0,
        }}>
          <TicketQr value={qrValue} size={130} vip={isVip} />

          <p style={{
            fontSize: "9px",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--tq-muted)",
          }}>
            Scan to verify
          </p>

          {seatStr && (
            <p style={{
              fontWeight: 900,
              fontSize: "16px",
              letterSpacing: "-0.03em",
              color: isVip ? "#D4A843" : "#fafafa",
              textAlign: "center",
            }}>
              {seatStr}
            </p>
          )}

          {isVip && !seatStr && (
            <p style={{
              fontWeight: 900,
              fontSize: "14px",
              letterSpacing: "-0.02em",
              color: "#D4A843",
              textAlign: "center",
            }}>
              VIP — FRONT
            </p>
          )}

          {/* Barcode strip */}
          <div style={{
            width: "150px",
            height: "26px",
            borderRadius: "4px",
            background: "var(--tq-void)",
            display: "flex",
            alignItems: "center",
            gap: "2px",
            padding: "4px 8px",
            overflow: "hidden",
          }}>
            {Array.from({ length: 34 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: `${8 + (i % 3) * 5}px`,
                  width: i % 3 === 1 ? "2px" : "1px",
                  background: isVip ? "#D4A843" : "#fafafa",
                  opacity: 0.85,
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

function Field({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p style={{
        fontSize: "9px",
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--tq-muted)",
        marginBottom: "3px",
        fontWeight: 500,
      }}>
        {label}
      </p>
      <p style={{
        fontSize: "13px",
        fontWeight: 700,
        letterSpacing: "-0.01em",
        color: accent ?? "var(--tq-off)",
      }}>
        {value}
      </p>
    </div>
  );
}
