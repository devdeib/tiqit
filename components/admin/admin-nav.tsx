import Link from "next/link";
import { TiqitLogo } from "@/components/ui/tiqit-logo";

const links = [
  { href: "/admin",                    label: "Dashboard" },
  { href: "/admin/events/pending",     label: "Pending events" },
  { href: "/admin/settings/payments",  label: "Payment settings" },
  { href: "/admin/users",              label: "Users" },
  { href: "/admin/webhooks",           label: "Webhooks" },
];

export function AdminNav({ email }: { email: string }) {
  return (
    <header
      style={{
        background: "var(--tq-base)",
        borderBottom: "1px solid var(--tq-rule)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
        <div className="flex items-center gap-2">
          <TiqitLogo size="sm" href="/admin" />
          <span
            className="tq-badge ml-2"
            style={{ background: "var(--tq-pink-dim)", color: "var(--tq-pink)", fontSize: "9px" }}
          >
            Admin
          </span>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-white"
              style={{ color: "var(--tq-muted)", fontWeight: 500 }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto tq-label">{email}</span>
      </div>
    </header>
  );
}
