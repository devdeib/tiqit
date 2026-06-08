import Link from "next/link";

type Props = { size?: "sm" | "md" | "lg"; href?: string };

export function TiqitLogo({ size = "md", href = "/" }: Props) {
  const cfg = {
    sm: { w: 28, h: 20, sw: 2.2, nr: 5,  rx: 3.5, fs: "17px" },
    md: { w: 38, h: 27, sw: 2.5, nr: 7,  rx: 5,   fs: "23px" },
    lg: { w: 52, h: 37, sw: 3,   nr: 9,  rx: 6,   fs: "34px" },
  }[size];

  const icon = (
    <svg
      width={cfg.w}
      height={cfg.h}
      viewBox={`0 0 ${cfg.w} ${cfg.h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {/* Ticket rectangle */}
      <rect
        x={cfg.sw / 2}
        y={cfg.sw / 2}
        width={cfg.w - cfg.sw}
        height={cfg.h - cfg.sw}
        rx={cfg.rx}
        stroke="#8B2FE8"
        strokeWidth={cfg.sw}
      />
      {/* Left notch */}
      <circle
        cx={0}
        cy={cfg.h / 2}
        r={cfg.nr}
        fill="#08060f"
        stroke="#8B2FE8"
        strokeWidth={cfg.sw}
      />
      {/* Right notch */}
      <circle
        cx={cfg.w}
        cy={cfg.h / 2}
        r={cfg.nr}
        fill="#08060f"
        stroke="#8B2FE8"
        strokeWidth={cfg.sw}
      />
    </svg>
  );

  const wordmark = (
    <span
      style={{
        fontFamily: "var(--font-geist-sans), 'Arial Black', sans-serif",
        fontSize: cfg.fs,
        fontWeight: 900,
        letterSpacing: "-0.04em",
        lineHeight: 1,
      }}
    >
      <span style={{ color: "#fafafa" }}>tiq</span>
      <span style={{ color: "#F72585" }}>it</span>
    </span>
  );

  const mark = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
      {icon}
      {wordmark}
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
      {mark}
    </Link>
  );
}
