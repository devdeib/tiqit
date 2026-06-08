import { PublicNav } from "./public-nav";

type Props = {
  children: React.ReactNode;
  withNav?: boolean;
};

export function PageShell({ children, withNav = true }: Props) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--tq-void)" }}>
      {withNav && <PublicNav />}
      <main className="flex-1">{children}</main>
      <footer
        className="mt-auto py-8 text-center"
        style={{ borderTop: "1px solid var(--tq-rule)", color: "var(--tq-muted)", fontSize: "11px", letterSpacing: "0.1em" }}
      >
        TIQIT — GCC EVENT INFRASTRUCTURE — {new Date().getFullYear()}
      </footer>
    </div>
  );
}
