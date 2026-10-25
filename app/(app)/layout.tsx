import { AppShell } from "@/components/shell";
import { requireAuth } from "@/lib/auth";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAuth();
  return <AppShell userName={context.profile.name} role={context.member.role}>{children}</AppShell>;
}
