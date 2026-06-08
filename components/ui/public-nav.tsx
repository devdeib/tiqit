import Link from "next/link";
import { TiqitLogo } from "./tiqit-logo";

export function PublicNav() {
  return (
    <header
      style={{
        background: "rgba(8,6,15,0.90)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--tq-rule)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TiqitLogo size="md" href="/" />
        <nav style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <Link
            href="/"
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--tq-muted)",
              textDecoration: "none",
              transition: "color .15s",
            }}
          >
            Events
          </Link>
          <Link href="/login" className="tq-btn-primary" style={{ padding: "8px 18px", fontSize: "13px" }}>
            Organizer login
          </Link>
        </nav>
      </div>
    </header>
  );
}
