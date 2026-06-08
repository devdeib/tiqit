import Link from "next/link";
import { TiqitLogo } from "@/components/ui/tiqit-logo";

type Props = { email: string; fullName: string };

const NAV_LINKS = [
  { href: "/organizer",         label: "Dashboard" },
  { href: "/organizer/events",  label: "Events" },
  { href: "/",                  label: "Public site" },
];

export function OrganizerNav({ email, fullName }: Props) {
  return (
    <header
      style={{
        background: "rgba(13,10,26,0.9)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--tq-rule)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-8">
          <TiqitLogo size="sm" href="/organizer" />
          <nav className="flex items-center gap-5 text-sm" style={{ color: "var(--tq-muted)" }}>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="transition-colors hover:text-white"
                style={{ fontWeight: 500 }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold" style={{ color: "var(--tq-white)" }}>
            {fullName}
          </p>
          <p className="tq-label">{email}</p>
        </div>
      </div>
    </header>
  );
}
