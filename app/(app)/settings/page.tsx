import { LockKeyhole, ServerCog, ShieldCheck } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireAuth } from "@/lib/auth";

export default async function SettingsPage() {
  const context = await requireAuth();
  const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  return <>
    <PageHeader eyebrow="Workspace settings" title="Settings" description="Deployment readiness and security posture for this workspace." />
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="p-6">
        <ServerCog className="text-royal" size={21} />
        <h2 className="mt-4 font-bold text-navy">Execution mode</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Application data is stored in Supabase Postgres; ClaimGuard uses deterministic analysis.</p>
        <Badge tone={configured ? "green" : "amber"}>{configured ? "Supabase configured" : "Supabase not configured"}</Badge>
      </Card>
      <Card className="p-6">
        <LockKeyhole className="text-teal" size={21} />
        <h2 className="mt-4 font-bold text-navy">Tenant isolation</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Server routes scope data to the current organisation. The server service-role client bypasses RLS; demo authentication must be replaced before production.</p>
        <Badge tone="blue">Server checked</Badge>
      </Card>
      <Card className="p-6">
        <ShieldCheck className="text-amber-500" size={21} />
        <h2 className="mt-4 font-bold text-navy">Approval policy</h2>
        <p className="mt-2 text-sm leading-6 text-muted">High-risk findings require resolution before a submission can enter the approval queue.</p>
        <Badge tone="teal">Human control on</Badge>
      </Card>
    </div>
    <Card className="mt-6 p-6">
      <h2 className="font-bold text-navy">Organisation</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-wider text-muted">Name</div><div className="mt-1 font-semibold text-navy">{context.organisation.name}</div></div>
        <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-wider text-muted">Slug</div><div className="mt-1 font-semibold text-navy">{context.organisation.slug}</div></div>
      </div>
    </Card>
  </>;
}
