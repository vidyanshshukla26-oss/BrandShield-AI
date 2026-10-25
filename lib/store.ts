import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { id, now } from "./utils";
import type { Store } from "./types";

const tables = {
  organisations: "organisations",
  profiles: "profiles",
  members: "organisation_members",
  guidelines: "brand_guidelines",
  facts: "approved_facts",
  terminology: "terminology_rules",
  assets: "brand_assets",
  submissions: "content_submissions",
  versions: "content_versions",
  analysisRuns: "analysis_runs",
  findings: "findings",
  comments: "review_comments",
  decisions: "approval_decisions",
  auditEvents: "audit_events",
} as const satisfies Record<keyof Store, string>;

type StoreCollection = keyof Store;
type StoreRow = { id: string };

const seedStore = (): Store => {
  const organisationId = "00000000-0000-4000-8000-000000000001";
  const profileId = "00000000-0000-4000-8000-000000000002";
  const memberId = "00000000-0000-4000-8000-000000000003";
  const timestamp = now();
  const guidelineId = "00000000-0000-4000-8000-000000000004";
  const factId = "00000000-0000-4000-8000-000000000005";
  const termId = "00000000-0000-4000-8000-000000000006";
  const submissionId = "00000000-0000-4000-8000-000000000007";
  const versionId = "00000000-0000-4000-8000-000000000008";
  const analysisId = "00000000-0000-4000-8000-000000000009";
  return {
    organisations: [{ id: organisationId, name: "Northstar Labs", slug: "northstar-labs", mode: "demo", createdAt: timestamp }],
    profiles: [{ id: profileId, name: "Demo Owner", email: "demo@brandshield.local" }],
    members: [{ id: memberId, organisationId, profileId, role: "owner", joinedAt: timestamp }],
    guidelines: [{ id: guidelineId, organisationId, title: "Evidence-first messaging", category: "Messaging", body: "Use clear, specific language. Never promise outcomes the approved facts do not support.", status: "approved", version: 1, createdAt: timestamp, updatedAt: timestamp }],
    facts: [{ id: factId, organisationId, name: "Customer onboarding time", value: "Most teams complete onboarding in 2–4 weeks", description: "Approved onboarding range for standard implementation.", source: "Customer Success Operations brief", verifiedAt: timestamp, reviewDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(), status: "approved", version: 1 }],
    terminology: [{ id: termId, organisationId, preferred: "Northstar platform", prohibited: "Northstar app", explanation: "Use the registered product name in customer-facing copy.", status: "approved" }],
    assets: [],
    submissions: [{ id: submissionId, organisationId, title: "Spring launch email", contentType: "email", campaign: "Spring launch", targetAudience: "Prospects", channel: "Email", priority: "high", status: "needs_changes", creatorId: profileId, currentVersionId: versionId, createdAt: timestamp, updatedAt: timestamp }],
    versions: [{ id: versionId, submissionId, version: 1, body: "Northstar app guarantees 300% growth in 14 days. Get started today.", createdBy: profileId, createdAt: timestamp }],
    analysisRuns: [{ id: analysisId, submissionId, contentVersionId: versionId, provider: "demo-deterministic", status: "completed", startedAt: timestamp, completedAt: timestamp }],
    findings: [{ id: "00000000-0000-4000-8000-000000000010", submissionId, analysisRunId: analysisId, contentVersionId: versionId, category: "unsupported_claim", severity: "critical", confidence: 0.98, excerpt: "guarantees 300% growth in 14 days", explanation: "The claim promises a specific business outcome that is not supported by an approved fact.", evidenceReferences: [{ type: "guideline", id: guidelineId, label: "Evidence-first messaging", version: 1 }], suggestedCorrection: "Explore the Northstar platform with a guided workflow for your growth goals.", humanReviewRequired: true, status: "open", createdAt: timestamp }],
    comments: [],
    decisions: [],
    auditEvents: [{ id: "00000000-0000-4000-8000-000000000011", organisationId, actorId: profileId, action: "analysis.completed", entityType: "submission", entityId: submissionId, metadata: { provider: "demo-deterministic" }, createdAt: timestamp }],
  };
};

function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase persistence is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function toDatabaseRow(value: StoreRow, collection: StoreCollection): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const fields = value as Record<string, unknown>;
  for (const [key, fieldValue] of Object.entries(fields)) {
    if (fieldValue === undefined) continue;
    const databaseKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    row[databaseKey] = fieldValue;
  }
  if (collection === "profiles") row.created_at = now();
  if (collection === "assets") {
    row.file_name = fields.fileName;
    row.storage_path = fields.fileName;
  }
  return row;
}

function fromDatabaseRow(row: Record<string, unknown>, collection: StoreCollection): StoreRow {
  const item: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const domainKey = key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    if (value !== null) item[domainKey] = value;
  }
  if (collection === "assets") item.fileName = row.file_name ?? row.storage_path ?? "";
  if (collection === "organisations") item.mode = row.mode ?? "live";
  return item as StoreRow;
}

function equalRows(left: StoreRow, right: StoreRow) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function persistChanges(client: SupabaseClient, before: Store, after: Store) {
  const changed = new Map<StoreCollection, StoreRow[]>();
  const deleted = new Map<StoreCollection, string[]>();

  for (const collection of Object.keys(tables) as StoreCollection[]) {
    const oldRows = before[collection] as StoreRow[];
    const newRows = after[collection] as StoreRow[];
    const oldById = new Map(oldRows.map((row) => [row.id, row]));
    const newById = new Map(newRows.map((row) => [row.id, row]));
    changed.set(collection, newRows.filter((row) => {
      const previous = oldById.get(row.id);
      return !previous || !equalRows(previous, row);
    }));
    deleted.set(collection, oldRows.filter((row) => !newById.has(row.id)).map((row) => row.id));
  }

  const upsertOrder: StoreCollection[] = [
    "profiles", "organisations", "members", "guidelines", "facts", "terminology",
    "assets", "submissions", "versions", "analysisRuns", "findings", "comments",
    "decisions", "auditEvents",
  ];
  const changes: Record<string, { upsert: Record<string, unknown>[]; delete: string[] }> = {};
  for (const collection of upsertOrder) {
    const rows = changed.get(collection) ?? [];
    const databaseRows = rows.map((row) => toDatabaseRow(row, collection));
    if (collection === "submissions") for (const row of databaseRows) row.current_version_id = null;
    changes[tables[collection]] = {
      upsert: databaseRows,
      delete: deleted.get(collection) ?? [],
    };
  }
  const deletionOnlyCollections = (Object.keys(tables) as StoreCollection[]).filter((collection) => !(collection in changes));
  for (const collection of deletionOnlyCollections) {
    changes[tables[collection]] = { upsert: [], delete: deleted.get(collection) ?? [] };
  }
  const linkSubmissions = (changed.get("submissions") ?? []).map((row) => toDatabaseRow(row, "submissions"));
  const { error } = await client.rpc("apply_brandshield_store_changes", {
    p_changes: { changes, linkSubmissions },
  });
  if (error) throw new Error(`Failed to persist Supabase store changes: ${error.message}`);
}

async function loadCollection(client: SupabaseClient, collection: StoreCollection): Promise<StoreRow[]> {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from(tables[collection]).select("*").range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Failed loading ${tables[collection]}: ${error.message}`);
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < pageSize) break;
  }
  return rows.map((row) => fromDatabaseRow(row, collection));
}

async function loadStore(client: SupabaseClient): Promise<Store> {
  const collections = Object.keys(tables) as StoreCollection[];
  const values = await Promise.all(collections.map((collection) => loadCollection(client, collection)));
  return Object.fromEntries(collections.map((collection, index) => [collection, values[index]])) as unknown as Store;
}

async function ensureDemoSeed(client: SupabaseClient) {
  if (process.env.NEXT_PUBLIC_APP_MODE !== "demo") return;
  const demoProfileId = "00000000-0000-4000-8000-000000000002";
  const { data, error } = await client.from(tables.profiles).select("id").eq("id", demoProfileId).maybeSingle();
  if (error) throw new Error(`Failed checking demo workspace: ${error.message}`);
  if (data) return;
  const emptyStore = Object.fromEntries(Object.keys(tables).map((key) => [key, []])) as unknown as Store;
  await persistChanges(client, emptyStore, seedStore());
}

export async function readStore(): Promise<Store> {
  const client = getSupabaseClient();
  await ensureDemoSeed(client);
  return loadStore(client);
}

export async function writeStore(store: Store): Promise<void> {
  const client = getSupabaseClient();
  const current = await loadStore(client);
  await persistChanges(client, current, store);
}

export async function mutateStore<T>(mutator: (store: Store) => T | Promise<T>): Promise<T> {
  const store = await readStore();
  const before = structuredClone(store);
  const result = await mutator(store);
  await persistChanges(getSupabaseClient(), before, store);
  return result;
}

export { id, now };
