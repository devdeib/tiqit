import Link from "next/link";

type Props = {
  email: string;
  fullName: string;
};

export function OrganizerNav({ email, fullName }: Props) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/organizer" className="font-semibold">
            Organizer
          </Link>
          <Link href="/organizer/events" className="text-neutral-600 hover:text-neutral-900">
            Events
          </Link>
          <Link href="/" className="text-neutral-600 hover:text-neutral-900">
            Public site
          </Link>
        </nav>
        <div className="text-right text-sm text-neutral-600">
          <p className="font-medium text-neutral-900">{fullName}</p>
          <p>{email}</p>
        </div>
      </div>
    </header>
  );
}
