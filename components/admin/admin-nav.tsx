import Link from "next/link";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/events/pending", label: "Pending events" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/settings/payments", label: "Payment settings" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/webhooks", label: "Webhooks" },
];

export function AdminNav({ email }: { email: string }) {
  return (
    <header className="border-b bg-neutral-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
        <Link href="/admin" className="font-semibold">
          Tiqit Admin
        </Link>
        <nav className="flex flex-wrap gap-3 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="opacity-90 hover:opacity-100">
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto text-xs text-neutral-400">{email}</span>
      </div>
    </header>
  );
}
