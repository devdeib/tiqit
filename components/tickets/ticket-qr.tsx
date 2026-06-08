"use client";

import { QRCodeSVG } from "qrcode.react";

type Props = { value: string; size?: number; vip?: boolean };

export function TicketQr({ value, size = 160, vip = false }: Props) {
  return (
    <div
      className="ticket-qr inline-flex rounded-lg p-3"
      style={{
        background: vip ? "var(--tq-gold)" : "#ffffff",
        border: vip ? "none" : "none",
      }}
      role="img"
      aria-label="Ticket QR code"
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        bgColor={vip ? "#D4A843" : "#ffffff"}
        fgColor="#08060f"
        marginSize={2}
        title="Ticket QR code"
      />
    </div>
  );
}
