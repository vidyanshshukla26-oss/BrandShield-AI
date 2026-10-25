import type { ReactNode } from "react";

export function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const styles = { primary: "bg-royal text-white hover:bg-blue-700", secondary: "bg-white text-navy border border-slate-200 hover:border-royal", ghost: "text-muted hover:bg-slate-100", danger: "bg-red-600 text-white hover:bg-red-700" };
  return <button className={`focus-ring inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${styles[variant]} ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`rounded-2xl border border-slate-200 bg-white shadow-soft ${className}`}>{children}</section>; }
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "teal" | "red" | "amber" | "green" }) {
  const tones = { neutral: "bg-slate-100 text-slate-700", blue: "bg-blue-50 text-blue-700", teal: "bg-teal-50 text-teal-700", red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700", green: "bg-emerald-50 text-emerald-700" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-teal">{eyebrow ?? "Workspace"}</div><h1 className="text-3xl font-bold tracking-tight text-navy dark:text-white">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>}</div>{actions && <div className="flex gap-2">{actions}</div>}</div>;
}

export function MetricCard({ label, value, detail, accent = "blue" }: { label: string; value: string | number; detail: string; accent?: "blue" | "teal" | "amber" | "red" }) {
  return <Card className="p-5"><div className={`mb-4 h-1.5 w-12 rounded-full ${accent === "blue" ? "bg-royal" : accent === "teal" ? "bg-teal" : accent === "amber" ? "bg-amber-400" : "bg-red-500"}`} /><div className="text-sm font-medium text-muted">{label}</div><div className="mt-1 text-3xl font-bold text-navy">{value}</div><div className="mt-2 text-xs text-muted">{detail}</div></Card>;
}
