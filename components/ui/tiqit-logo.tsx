import Link from "next/link";

type Props = { size?: "sm" | "md" | "lg"; href?: string };

export function TiqitLogo({ size = "md", href = "/" }: Props) {
  const configs = {
    sm: { wordSize: "18px", iconW: 28, iconH: 20, strokeW: 2, notchR: 5, rx: 4 },
    md: { wordSize: "24px", iconW: 38, iconH: 26, strokeW: 2.5, notchR: 6, rx: 5 },
    lg: { wordSize: "36px", iconW: 54, iconH: 38, strokeW: 3, notchR: 9, rx: 7 },
  };
  const c = configs[size];

  const mark = (
    <span className="inline-flex items-center gap-2">
      {/* Ticket icon — purple outline, two notch circles */}
      <svg
        width={c.iconW}
        height={c.iconH}
        viewBox={`0 0 ${c.iconW} ${c.iconH}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Outer ticket rect */}
        <rect
          x={c.strokeW / 2}
          y={c.strokeW / 2}
          width={c.iconW - c.strokeW}
          height={c.iconH - c.strokeW}
          rx={c.rx}
          stroke="#8B2FE8"
          strokeWidth={c.strokeW}
          fill="none"
        />
        {/* Left notch circle */}
        <circle
          cx={0}
          cy={c.iconH / 2}
          r={c.notchR}
          stroke="#8B2FE8"
          strokeWidth={c.strokeW}
          fill="var(--tq-void, #08060f)"
        />
        {/* Right notch circle */}
        <circle
          cx={c.iconW}
          cy={c.iconH / 2}
          r={c.notchR}
          stroke="#8B2FE8"
          strokeWidth={c.strokeW}
          fill="var(--tq-void, #08060f)"
        />
      </svg>

      {/* Wordmark: "tiq" white + "it" pink */}
      <span
        style={{
          fontFamily: "var(--font-geist-sans), 'Helvetica Neue', Arial Black, sans-serif",
          fontSize: c.wordSize,
          fontWeight: 900,
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}
      >
        <span style={{ color: "#fafafa" }}>tiq</span>
        <span style={{ color: "#F72585" }}>it</span>
      </span>
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
      {mark}
    </Link>
  );
}
