import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Lock, QrCode, Zap, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Snip — URL shortener with analytics" },
      { name: "description", content: "Shorten URLs, customize aliases, protect with passwords, generate QR codes, and track every click." },
      { property: "og:title", content: "Snip — URL shortener" },
      { property: "og:description", content: "Shorten URLs and track analytics in real time." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-accent glow-ring" />
          <span className="text-lg font-semibold tracking-tight">Snip</span>
        </Link>
        <nav className="flex items-center gap-3">
          {user ? (
            <Link to="/dashboard"><Button variant="default">Dashboard</Button></Link>
          ) : (
            <>
              <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
              <Link to="/auth" search={{ mode: "signup" }}><Button>Get started</Button></Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-24 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-accent animate-pulse" /> Production-grade · open source
          </div>
          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-7xl">
            Short links,<br />
            <span className="text-gradient">serious analytics.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Shrink URLs in a click. Customize aliases, lock with passwords, set expiries,
            generate QR codes, and watch traffic in real time.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to={user ? "/urls/new" : "/auth"} search={user ? undefined : { mode: "signup" }}>
              <Button size="lg" className="gap-2">
                Shorten a URL <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#features"><Button size="lg" variant="outline">See features</Button></a>
          </div>
        </section>

        <section id="features" className="grid gap-4 pb-24 md:grid-cols-4">
          {[
            { icon: Zap, title: "Instant", desc: "Sub-100ms redirects with edge caching." },
            { icon: BarChart3, title: "Analytics", desc: "Track clicks, devices, referrers." },
            { icon: Lock, title: "Password-protect", desc: "Lock any link with a password." },
            { icon: QrCode, title: "QR codes", desc: "Auto-generated for every short URL." },
          ].map((f) => (
            <div key={f.title} className="glass-card rounded-xl p-5">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Snip</span>
          <a href="https://github.com" className="flex items-center gap-1.5 hover:text-foreground"><Github className="size-4" /> Source</a>
        </div>
      </footer>
    </div>
  );
}
