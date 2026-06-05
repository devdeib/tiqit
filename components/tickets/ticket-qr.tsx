"use client";

import QRCode from "react-qr-code";

type TicketQrProps = {
  value: string;
  size?: number;
};

export function TicketQr({ value, size = 200 }: TicketQrProps) {
  return (
    <div
      className="inline-flex rounded border bg-white p-3"
      role="img"
      aria-label="Ticket QR code"
    >
      <QRCode
        value={value}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor="#000000"
      />
    </div>
  );
}
