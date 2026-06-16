import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Copy, ExternalLink, Trash2, Download, MousePointerClick, Clock, Lock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/urls/$id")({
  head: () => ({ meta: [{ title: "URL details — Snip" }] }),
  component: UrlDetails,
});

function UrlDetails() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const urlQ = useQuery({
    queryKey: ["url", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("urls").select("*").eq("id", id).eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  const clicksQ = useQuery({
    queryKey: ["clicks", id],
    enabled: !!urlQ.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("click_events").select("*").eq("url_id", id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const shortUrl = urlQ.data ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${urlQ.data.short_code}` : "";

  useEffect(() => {
    if (shortUrl) QRCode.toDataURL(shortUrl, { width: 320, margin: 1, color: { dark: "#0a0a0f", light: "#ffffff" } }).then(setQrDataUrl);
  }, [shortUrl]);

  type UrlPatch = Partial<{ title: string | null; description: string | null; is_active: boolean; expires_at: string | null }>;
  const update = useMutation({
    mutationFn: async (patch: UrlPatch) => {
      const { error } = await supabase.from("urls").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["url", id] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("urls").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); navigate({ to: "/urls" }); },
  });

  if (urlQ.isLoading) return <div className="h-64 animate-pulse rounded-xl bg-muted/30" />;
  if (urlQ.error || !urlQ.data) return <div className="text-center text-muted-foreground">URL not found.</div>;

  const u = urlQ.data;
  const expired = u.expires_at && new Date(u.expires_at) < new Date();
  const totalClicks = clicksQ.data?.length ?? u.total_clicks ?? 0;

  return (
    <div className="space-y-6">
      <Link to="/urls" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to URLs</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-bold text-gradient">/r/{u.short_code}</h1>
            {u.password_hash && <Badge variant="secondary" className="gap-1"><Lock className="size-3" /> Locked</Badge>}
            {expired && <Badge variant="destructive" className="gap-1"><Clock className="size-3" /> Expired</Badge>}
            {!u.is_active && <Badge variant="outline">Inactive</Badge>}
          </div>
          <a href={u.original_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 truncate text-sm text-muted-foreground hover:text-foreground">
            <ExternalLink className="size-3" /> {u.original_url}
          </a>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(shortUrl); toast.success("Copied"); }}><Copy className="size-4" /> Copy</Button>
          <Button variant="destructive" onClick={() => { if (confirm("Delete this URL?")) del.mutate(); }}><Trash2 className="size-4" /></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={MousePointerClick} label="Total clicks" value={totalClicks} />
        <Stat label="Created" value={format(new Date(u.created_at), "MMM d, yyyy")} />
        <Stat label="Last accessed" value={u.last_accessed_at ? formatDistanceToNow(new Date(u.last_accessed_at), { addSuffix: true }) : "Never"} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="glass-card space-y-4 rounded-xl p-6 md:col-span-2">
          <h2 className="font-semibold">Settings</h2>
          <div>
            <Label>Title</Label>
            <Input defaultValue={u.title ?? ""} onBlur={(e) => e.target.value !== (u.title ?? "") && update.mutate({ title: e.target.value || null })} />
          </div>
          <div>
            <Label>Description</Label>
            <Input defaultValue={u.description ?? ""} onBlur={(e) => e.target.value !== (u.description ?? "") && update.mutate({ description: e.target.value || null })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-background/30 p-4">
            <div>
              <div className="font-medium">Active</div>
              <div className="text-xs text-muted-foreground">Disable to stop redirects without deleting.</div>
            </div>
            <Switch checked={u.is_active} onCheckedChange={(v) => update.mutate({ is_active: v })} />
          </div>
          <div>
            <Label>Expires at</Label>
            <Input
              type="datetime-local"
              defaultValue={u.expires_at ? format(new Date(u.expires_at), "yyyy-MM-dd'T'HH:mm") : ""}
              onBlur={(e) => update.mutate({ expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>
        </div>

        <div className="glass-card flex flex-col items-center rounded-xl p-6">
          <h2 className="self-start font-semibold">QR code</h2>
          {qrDataUrl && <img src={qrDataUrl} alt="QR" className="mt-4 size-48 rounded-lg bg-white p-2" />}
          <a href={qrDataUrl} download={`${u.short_code}.png`}>
            <Button variant="outline" size="sm" className="mt-4 gap-2"><Download className="size-4" /> Download</Button>
          </a>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="mb-4 font-semibold">Recent clicks</h2>
        {clicksQ.isLoading ? (
          <div className="h-20 animate-pulse rounded bg-muted/30" />
        ) : (clicksQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No clicks yet. Share your short URL to start tracking.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr>
                <th className="px-2 py-2 text-left">When</th>
                <th className="px-2 py-2 text-left">Device</th>
                <th className="px-2 py-2 text-left">Browser</th>
                <th className="px-2 py-2 text-left">Referrer</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {clicksQ.data!.map((c) => (
                  <tr key={c.id}>
                    <td className="px-2 py-2">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</td>
                    <td className="px-2 py-2 text-muted-foreground">{c.device ?? "—"}</td>
                    <td className="px-2 py-2 text-muted-foreground">{c.browser ?? "—"}</td>
                    <td className="px-2 py-2 truncate text-muted-foreground">{c.referrer ?? "Direct"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon?: any; label: string; value: any }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{Icon && <Icon className="size-4" />} {label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
