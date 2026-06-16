import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateShortCode, SHORT_CODE_REGEX, hashPassword } from "@/lib/short-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const schema = z.object({
  original_url: z.string().trim().url("Must be a valid URL").max(2048),
  custom_alias: z.string().trim().regex(SHORT_CODE_REGEX, "3–32 chars, letters/numbers/-/_").optional().or(z.literal("")),
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  expires_at: z.string().optional(),
  password: z.string().min(4).max(64).optional().or(z.literal("")),
  enable_expiry: z.boolean(),
  enable_password: z.boolean(),
});
type Form = z.infer<typeof schema>;

export const Route = createFileRoute("/_authenticated/urls/new")({
  head: () => ({ meta: [{ title: "Create short URL — Snip" }, { name: "description", content: "Create a new short URL with optional alias, expiry, and password." }] }),
  component: NewUrl,
});

function NewUrl() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { original_url: "", custom_alias: "", title: "", description: "", expires_at: "", password: "", enable_expiry: false, enable_password: false },
  });
  const enableExpiry = form.watch("enable_expiry");
  const enablePassword = form.watch("enable_password");

  async function onSubmit(v: Form) {
    if (!user) return;
    setBusy(true);
    try {
      let short_code = v.custom_alias?.trim() || generateShortCode();
      // Check uniqueness for custom alias
      if (v.custom_alias) {
        const { data: existing } = await supabase.from("urls").select("id").eq("short_code", short_code).maybeSingle();
        if (existing) { toast.error("Alias already taken"); setBusy(false); return; }
      } else {
        // Retry a couple of times on rare collision
        for (let i = 0; i < 3; i++) {
          const { data } = await supabase.from("urls").select("id").eq("short_code", short_code).maybeSingle();
          if (!data) break;
          short_code = generateShortCode();
        }
      }
      const password_hash = v.enable_password && v.password ? await hashPassword(v.password) : null;
      const { data, error } = await supabase.from("urls").insert({
        user_id: user.id,
        original_url: v.original_url.trim(),
        short_code,
        title: v.title?.trim() || null,
        description: v.description?.trim() || null,
        expires_at: v.enable_expiry && v.expires_at ? new Date(v.expires_at).toISOString() : null,
        password_hash,
      }).select("id").single();
      if (error) throw error;
      toast.success("Short URL created");
      navigate({ to: "/urls/$id", params: { id: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create URL");
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/urls" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back</Link>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create short URL</h1>
        <p className="mt-1 text-muted-foreground">Shorten any URL with optional alias, expiry, and password.</p>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="glass-card space-y-5 rounded-xl p-6">
        <Field label="Destination URL *" error={form.formState.errors.original_url?.message}>
          <Input {...form.register("original_url")} placeholder="https://example.com/very/long/url" />
        </Field>
        <Field label="Custom alias (optional)" error={form.formState.errors.custom_alias?.message} hint="Leave empty for a random code.">
          <Input {...form.register("custom_alias")} placeholder="my-link" className="font-mono" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title (optional)"><Input {...form.register("title")} placeholder="Marketing campaign" /></Field>
          <Field label="Description (optional)"><Input {...form.register("description")} placeholder="Q4 launch" /></Field>
        </div>

        <ToggleRow label="Set expiry date" checked={enableExpiry} onChange={(v) => form.setValue("enable_expiry", v)}>
          {enableExpiry && <Input type="datetime-local" {...form.register("expires_at")} />}
        </ToggleRow>

        <ToggleRow label="Password protect" checked={enablePassword} onChange={(v) => form.setValue("enable_password", v)}>
          {enablePassword && <Input type="password" placeholder="Min 4 chars" {...form.register("password")} />}
        </ToggleRow>

        <Button type="submit" disabled={busy} className="w-full">{busy ? "Creating…" : "Create short URL"}</Button>
      </form>
    </div>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ToggleRow({ label, checked, onChange, children }: { label: string; checked: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/30 p-4">
      <div className="flex items-center justify-between">
        <Label className="cursor-pointer">{label}</Label>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
      {children}
    </div>
  );
}
