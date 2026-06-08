import Link from "next/link";
import { TiqitLogo } from "@/components/ui/tiqit-logo";

const NAV = [
  { href: "/organizer",        label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/",                 label: "Public site" },
];

export function OrganizerNav({ email, fullName }: { email: string; fullName: string }) {
  return (
    <header style={{ background: "rgba(13,10,26,.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--tq-rule)", position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <TiqitLogo size="sm" href="/organizer" />
          <nav style={{ display: "flex", gap: "18px" }}>
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} style={{ fontSize: "13px", fontWeight: 500, color: "var(--tq-muted)", textDecoration: "none" }}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--tq-white)" }}>{fullName}</p>
          <p style={{ fontSize: "10px", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tq-muted)" }}>{email}</p>
        </div>
      </div>
    </header>
  );
}
