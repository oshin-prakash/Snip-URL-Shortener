import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Copy, Trash2, Plus, ExternalLink, Lock, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const searchSchema = z.object({
  q: z.string().optional(),
  filter: z.enum(["all", "active", "expired", "inactive"]).optional(),
  page: z.coerce.number().min(1).optional(),
});

const PAGE_SIZE = 10;

export const Route = createFileRoute("/_authenticated/urls/")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Your URLs — Snip" }, { name: "description", content: "Manage your short URLs." }] }),
  component: UrlList,
});

function UrlList() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [qInput, setQInput] = useState(search.q ?? "");
  const page = search.page ?? 1;
  const filter = search.filter ?? "all";

  const query = useQuery({
    queryKey: ["urls", user?.id, search.q, filter, page],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("urls").select("*", { count: "exact" }).eq("user_id", user!.id);
      if (search.q) q = q.or(`short_code.ilike.%${search.q}%,original_url.ilike.%${search.q}%,title.ilike.%${search.q}%`);
      if (filter === "active") q = q.eq("is_active", true);
      if (filter === "inactive") q = q.eq("is_active", false);
      if (filter === "expired") q = q.lt("expires_at", new Date().toISOString());
      q = q.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("urls").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("URL deleted"); qc.invalidateQueries({ queryKey: ["urls"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function copy(code: string) {
    navigator.clipboard.writeText(`${window.location.origin}/r/${code}`);
    toast.success("Copied");
  }

  const totalPages = Math.max(1, Math.ceil((query.data?.count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your URLs</h1>
          <p className="mt-1 text-muted-foreground">{query.data?.count ?? 0} total</p>
        </div>
        <Link to="/urls/new"><Button className="gap-2"><Plus className="size-4" /> New URL</Button></Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <form onSubmit={(e) => { e.preventDefault(); navigate({ search: { ...search, q: qInput || undefined, page: 1 } }); }} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search code, URL, or title" className="pl-9" />
        </form>
        <Select value={filter} onValueChange={(v) => navigate({ search: { ...search, filter: v as any, page: 1 } })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card overflow-hidden rounded-xl">
        {query.isLoading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded bg-muted/40" />)}</div>
        ) : query.data?.rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">No URLs match your filters.</p>
            <Link to="/urls/new" className="mt-4 inline-block"><Button size="sm">Create one</Button></Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {query.data?.rows.map((u) => {
              const expired = u.expires_at && new Date(u.expires_at) < new Date();
              return (
                <li key={u.id} className="flex items-center gap-3 p-4">
                  <Link to="/urls/$id" params={{ id: u.id }} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-primary">/r/{u.short_code}</span>
                      {u.password_hash && <Badge variant="secondary" className="gap-1"><Lock className="size-3" /> Locked</Badge>}
                      {expired && <Badge variant="destructive" className="gap-1"><Clock className="size-3" /> Expired</Badge>}
                      {!u.is_active && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{u.title || u.original_url}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{u.total_clicks ?? 0} clicks · {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</div>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => copy(u.short_code)} aria-label="Copy"><Copy className="size-4" /></Button>
                  <a href={`/r/${u.short_code}`} target="_blank" rel="noreferrer"><Button variant="ghost" size="icon" aria-label="Open"><ExternalLink className="size-4" /></Button></a>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this URL?")) del.mutate(u.id); }} aria-label="Delete"><Trash2 className="size-4" /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => navigate({ search: { ...search, page: page - 1 } })}>Prev</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => navigate({ search: { ...search, page: page + 1 } })}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
