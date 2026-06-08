import { PublicNav } from "./public-nav";

export function PageShell({
  children,
  withNav = true,
}: {
  children: React.ReactNode;
  withNav?: boolean;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", background: "var(--tq-void)" }}>
      {withNav && <PublicNav />}
      <main style={{ flex: 1 }}>{children}</main>
      <footer
        style={{
          borderTop: "1px solid var(--tq-rule)",
          padding: "28px 24px",
          textAlign: "center",
          fontSize: "10px",
          letterSpacing: ".12em",
          color: "var(--tq-sub)",
        }}
      >
        TIQIT — GCC EVENT INFRASTRUCTURE — {new Date().getFullYear()}
      </footer>
    </div>
  );
}
