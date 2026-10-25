import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const configured = Boolean(process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY);

describe.skipIf(!configured)("Supabase integration and tenant isolation", () => {
  it("can reach the migrated schema with the service role", async () => {
    const admin = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await admin.from("organisations").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("does not expose organisations to an unauthenticated anon client", async () => {
    const anon = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await anon.from("organisations").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("isolates organisation rows for an authenticated member", async () => {
    const admin = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    const email = `brandshield-test-${Date.now()}@example.invalid`; const password = `Test-${Date.now()}-Password!`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(createError).toBeNull(); expect(created.user).toBeTruthy();
    const profileId = created.user!.id;
    const firstOrg = `test-org-${Date.now()}`; const secondOrg = `test-org-private-${Date.now()}`;
    const { data: org, error: orgError } = await admin.from("organisations").insert([{ name: "Isolation Test", slug: firstOrg }, { name: "Private Test", slug: secondOrg }]).select("id,slug");
    expect(orgError).toBeNull(); expect(org).toHaveLength(2);
    const memberOrgId = org!.find((entry) => entry.slug === firstOrg)!.id;
    await admin.from("profiles").insert({ id: profileId, name: "Isolation Test", email });
    await admin.from("organisation_members").insert({ organisation_id: memberOrgId, profile_id: profileId, role: "creator" });
    const userClient = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: signInError } = await userClient.auth.signInWithPassword({ email, password }); expect(signInError).toBeNull();
    const { data: visible, error: visibleError } = await userClient.from("organisations").select("slug");
    expect(visibleError).toBeNull(); expect(visible?.map((entry) => entry.slug)).toEqual([firstOrg]);
    await admin.from("organisation_members").delete().eq("profile_id", profileId); await admin.from("profiles").delete().eq("id", profileId); await admin.from("organisations").delete().in("slug", [firstOrg, secondOrg]); await admin.auth.admin.deleteUser(profileId);
  });
});
