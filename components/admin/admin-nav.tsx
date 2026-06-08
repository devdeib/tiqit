import Link from "next/link";
import { TiqitLogo } from "@/components/ui/tiqit-logo";

const NAV = [
  { href: "/admin",                   label: "Dashboard" },
  { href: "/admin/events/pending",    label: "Pending events" },
  { href: "/admin/settings/payments", label: "Payments" },
  { href: "/admin/users",             label: "Users" },
  { href: "/admin/webhooks",          label: "Webhooks" },
];

export function AdminNav({ email }: { email: string }) {
  return (
    <header style={{ background: "var(--tq-base)", borderBottom: "1px solid var(--tq-rule)", position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <TiqitLogo size="sm" href="/admin" />
        <span style={{ background: "var(--tq-pink)", color: "#fff", fontSize: "9px", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", padding: "2px 8px", borderRadius: "4px" }}>
          Admin
        </span>
        <nav style={{ display: "flex", gap: "16px", flex: 1 }}>
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} style={{ fontSize: "13px", fontWeight: 500, color: "var(--tq-muted)", textDecoration: "none" }}>
              {l.label}
            </Link>
          ))}
        </nav>
        <span style={{ fontSize: "10px", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tq-muted)" }}>{email}</span>
      </div>
    </header>
  );
}
