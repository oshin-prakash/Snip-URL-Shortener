import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hashPassword } from "@/lib/short-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, AlertCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/r/$code")({
  ssr: false,
  head: () => ({ meta: [{ title: "Redirecting… — Snip" }, { name: "robots", content: "noindex" }] }),
  component: Redirector,
});

type State =
  | { kind: "loading" }
  | { kind: "password"; urlId: string; originalUrl: string; passwordHash: string }
  | { kind: "redirect"; to: string }
  | { kind: "expired" }
  | { kind: "notfound" };

function detectBrowser(ua: string) {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}
function detectDevice(ua: string) {
  if (/Mobi|Android/i.test(ua)) return "Mobile";
  if (/Tablet|iPad/i.test(ua)) return "Tablet";
  return "Desktop";
}

async function logClick(urlId: string) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  await supabase.from("click_events").insert({
    url_id: urlId,
    user_agent: ua,
    browser: detectBrowser(ua),
    device: detectDevice(ua),
    referrer: document.referrer || null,
  });
}

export default function Redirector() {
  const { code } = Route.useParams();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // First try: public read (RLS limits to active + non-expired)
      const { data: pub } = await supabase
        .from("urls")
        .select("id, original_url, password_hash, expires_at, is_active")
        .eq("short_code", code)
        .maybeSingle();

      if (!pub) { setState({ kind: "notfound" }); return; }
      if (!pub.is_active) { setState({ kind: "notfound" }); return; }
      if (pub.expires_at && new Date(pub.expires_at) < new Date()) { setState({ kind: "expired" }); return; }

      if (pub.password_hash) {
        setState({ kind: "password", urlId: pub.id, originalUrl: pub.original_url, passwordHash: pub.password_hash });
        return;
      }

      // Fire-and-forget analytics, then redirect
      logClick(pub.id).catch(() => {});
      setState({ kind: "redirect", to: pub.original_url });
    })();
  }, [code]);

  useEffect(() => {
    if (state.kind === "redirect") {
      const t = setTimeout(() => { window.location.replace(state.to); }, 300);
      return () => clearTimeout(t);
    }
  }, [state]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== "password") return;
    const h = await hashPassword(pwInput);
    if (h !== state.passwordHash) { setPwError("Incorrect password"); return; }
    logClick(state.urlId).catch(() => {});
    window.location.replace(state.originalUrl);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {state.kind === "loading" && (
          <div className="glass-card flex flex-col items-center gap-3 rounded-2xl p-10">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Looking up link…</p>
          </div>
        )}
        {state.kind === "redirect" && (
          <div className="glass-card rounded-2xl p-10">
            <Loader2 className="mx-auto size-6 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Redirecting…</p>
            <a href={state.to} className="mt-4 inline-block text-xs text-primary hover:underline">Click here if not redirected</a>
          </div>
        )}
        {state.kind === "password" && (
          <form onSubmit={submitPassword} className="glass-card space-y-4 rounded-2xl p-8 text-left">
            <div className="flex items-center gap-2">
              <Lock className="size-5 text-primary" />
              <h1 className="text-xl font-bold">Password required</h1>
            </div>
            <p className="text-sm text-muted-foreground">This short link is password-protected.</p>
            <div>
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" value={pwInput} onChange={(e) => { setPwInput(e.target.value); setPwError(null); }} autoFocus />
              {pwError && <p className="mt-1 text-xs text-destructive">{pwError}</p>}
            </div>
            <Button type="submit" className="w-full">Unlock</Button>
          </form>
        )}
        {(state.kind === "expired" || state.kind === "notfound") && (
          <div className="glass-card rounded-2xl p-10">
            <AlertCircle className="mx-auto size-10 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold">{state.kind === "expired" ? "Link expired" : "Link not found"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {state.kind === "expired"
                ? "This short URL has reached its expiry date and is no longer active."
                : "This short URL doesn't exist or has been deactivated."}
            </p>
            <Link to="/" className="mt-6 inline-block"><Button>Go home</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
