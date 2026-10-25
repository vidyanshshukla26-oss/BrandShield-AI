import "server-only";
import { cookies } from "next/headers";
import { readStore } from "./store";
import type { AuthContext, Role } from "./types";

export const DEMO_USER_COOKIE = "brandshield-user";

export async function getAuthContext(): Promise<AuthContext | null> {
  const store = await readStore();
  const cookieStore = await cookies();
  const profileId = cookieStore.get(DEMO_USER_COOKIE)?.value ?? "profile_demo";
  const profile = store.profiles.find((entry) => entry.id === profileId) ?? store.profiles[0];
  if (!profile) return null;
  const member = store.members.find((entry) => entry.profileId === profile.id);
  if (!member) return null;
  const organisation = store.organisations.find((entry) => entry.id === member.organisationId);
  if (!organisation) return null;
  return { profile, member, organisation };
}

export function hasRole(role: Role, allowed: Role[]) {
  return allowed.includes(role);
}

export async function requireAuth() {
  const context = await getAuthContext();
  if (!context) throw new Error("UNAUTHENTICATED");
  return context;
}
