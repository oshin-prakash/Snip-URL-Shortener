import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Link2, MousePointerClick, TrendingUp, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Snip" }, { name: "description", content: "Overview of your short URLs and click activity." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();

  const stats = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ count: urlCount }, { data: clicks }, { data: recent }] = await Promise.all([
        supabase.from("urls").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("click_events").select("id, urls!inner(user_id)").eq("urls.user_id", user!.id),
        supabase.from("urls").select("id, short_code, original_url, created_at, title").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5),
      ]);
      return { urlCount: urlCount ?? 0, clickCount: clicks?.length ?? 0, recent: recent ?? [] };
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Welcome back{user?.user_metadata?.name ? `, ${user.user_metadata.name}` : ""}.</p>
        </div>
        <Link to="/urls/new"><Button className="gap-2"><Plus className="size-4" /> New URL</Button></Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Link2} label="Total URLs" value={stats.data?.urlCount ?? "—"} loading={stats.isLoading} />
        <StatCard icon={MousePointerClick} label="Total clicks" value={stats.data?.clickCount ?? "—"} loading={stats.isLoading} />
        <StatCard icon={TrendingUp} label="Avg / URL" value={stats.data?.urlCount ? Math.round((stats.data.clickCount / stats.data.urlCount) * 10) / 10 : 0} loading={stats.isLoading} />
      </div>

      <div className="glass-card rounded-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Recent URLs</h2>
          <Link to="/urls" className="text-sm text-primary hover:underline">View all →</Link>
        </div>
        {stats.isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-muted/40" />)}</div>
        ) : stats.data?.recent.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-border">
            {stats.data?.recent.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-3">
                <Link to="/urls/$id" params={{ id: u.id }} className="min-w-0 flex-1">
                  <div className="font-mono text-sm text-primary">/r/{u.short_code}</div>
                  <div className="truncate text-xs text-muted-foreground">{u.title || u.original_url}</div>
                </Link>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, loading }: { icon: any; label: string; value: any; loading?: boolean }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" /> {label}</div>
      <div className="mt-2 text-3xl font-bold">{loading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted/40" /> : value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <Link2 className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">No URLs yet. Create your first short link.</p>
      <Link to="/urls/new" className="mt-4 inline-block"><Button size="sm">Create URL</Button></Link>
    </div>
  );
}
