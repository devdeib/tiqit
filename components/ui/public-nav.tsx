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
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"
      >
        <TiqitLogo size="md" href="/" />
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium transition-colors hover:text-white"
            style={{ color: "var(--tq-muted)" }}
          >
            Events
          </Link>
          <Link
            href="/login"
            className="tq-btn-primary"
            style={{ padding: "8px 18px", fontSize: "13px" }}
          >
            Organizer login
          </Link>
        </nav>
      </div>
    </header>
  );
}
