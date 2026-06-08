/**
 * Shared layout shells for every portal.
 * Keeps background, font, and base spacing consistent.
 */

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--tq-void)",
        color: "var(--tq-white)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}

export function PageContent({
  children,
  maxWidth = "900px",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        maxWidth,
        margin: "0 auto",
        padding: "40px 24px 64px",
      }}
    >
      {children}
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: "32px" }}>
      {eyebrow && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 10px",
            borderRadius: "9999px",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            background: "var(--tq-purple-dim)",
            color: "var(--tq-purple-lt)",
            marginBottom: "12px",
          }}
        >
          {eyebrow}
        </span>
      )}
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 900,
          letterSpacing: "-0.04em",
          color: "var(--tq-white)",
          marginBottom: subtitle ? "6px" : 0,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: "13px", color: "var(--tq-muted)" }}>{subtitle}</p>
      )}
    </div>
  );
}
