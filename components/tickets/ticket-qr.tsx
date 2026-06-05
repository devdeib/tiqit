"use client";

import { QRCodeSVG } from "qrcode.react";

type TicketQrProps = {
  value: string;
  size?: number;
};

export function TicketQr({ value, size = 200 }: TicketQrProps) {
  return (
    <div
      className="ticket-qr inline-flex rounded border border-neutral-200 bg-white p-3 print:border-black print:p-4"
      role="img"
      aria-label="Ticket QR code"
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor="#000000"
        marginSize={4}
        title="Ticket QR code"
      />
    </div>
  );
}
