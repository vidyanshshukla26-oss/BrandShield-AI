import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { id, now } from "./utils";
import type { Store } from "./types";

const dataPath = path.join(process.cwd(), "data", "store.json");

const seedStore = (): Store => {
  const organisationId = "org_demo";
  const profileId = "profile_demo";
  const timestamp = now();
  const guidelineId = "guide_demo_tone";
  const factId = "fact_demo_customers";
  const termId = "term_demo_brand";
  const submissionId = "submission_demo_1";
  const versionId = "version_demo_1";
  const analysisId = "analysis_demo_1";
  return {
    organisations: [{ id: organisationId, name: "Northstar Labs", slug: "northstar-labs", mode: "demo", createdAt: timestamp }],
    profiles: [{ id: profileId, name: "Demo Owner", email: "demo@brandshield.local" }],
    members: [{ id: "member_demo", organisationId, profileId, role: "owner", joinedAt: timestamp }],
    guidelines: [{ id: guidelineId, organisationId, title: "Evidence-first messaging", category: "Messaging", body: "Use clear, specific language. Never promise outcomes the approved facts do not support.", status: "approved", version: 1, createdAt: timestamp, updatedAt: timestamp }],
    facts: [{ id: factId, organisationId, name: "Customer onboarding time", value: "Most teams complete onboarding in 2–4 weeks", description: "Approved onboarding range for standard implementation.", source: "Customer Success Operations brief", verifiedAt: timestamp, reviewDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(), status: "approved", version: 1 }],
    terminology: [{ id: termId, organisationId, preferred: "Northstar platform", prohibited: "Northstar app", explanation: "Use the registered product name in customer-facing copy.", status: "approved" }],
    assets: [],
    submissions: [{ id: submissionId, organisationId, title: "Spring launch email", contentType: "email", campaign: "Spring launch", targetAudience: "Prospects", channel: "Email", priority: "high", status: "needs_changes", creatorId: profileId, currentVersionId: versionId, createdAt: timestamp, updatedAt: timestamp }],
    versions: [{ id: versionId, submissionId, version: 1, body: "Northstar app guarantees 300% growth in 14 days. Get started today.", createdBy: profileId, createdAt: timestamp }],
    analysisRuns: [{ id: analysisId, submissionId, contentVersionId: versionId, provider: "demo-deterministic", status: "completed", startedAt: timestamp, completedAt: timestamp }],
    findings: [{ id: "finding_demo_1", submissionId, analysisRunId: analysisId, contentVersionId: versionId, category: "unsupported_claim", severity: "critical", confidence: 0.98, excerpt: "guarantees 300% growth in 14 days", explanation: "The claim promises a specific business outcome that is not supported by an approved fact.", evidenceReferences: [{ type: "guideline", id: guidelineId, label: "Evidence-first messaging", version: 1 }], suggestedCorrection: "Explore the Northstar platform with a guided workflow for your growth goals.", humanReviewRequired: true, status: "open", createdAt: timestamp }],
    comments: [],
    decisions: [],
    auditEvents: [{ id: "audit_demo_1", organisationId, actorId: profileId, action: "analysis.completed", entityType: "submission", entityId: submissionId, metadata: { provider: "demo-deterministic" }, createdAt: timestamp }],
  };
};

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  try {
    await fs.access(dataPath);
  } catch {
    await fs.writeFile(dataPath, JSON.stringify(seedStore(), null, 2), "utf8");
  }
}

export async function readStore(): Promise<Store> {
  await ensureStoreFile();
  return JSON.parse(await fs.readFile(dataPath, "utf8")) as Store;
}

export async function writeStore(store: Store): Promise<void> {
  await ensureStoreFile();
  await fs.writeFile(dataPath, JSON.stringify(store, null, 2), "utf8");
}

export async function mutateStore<T>(mutator: (store: Store) => T | Promise<T>): Promise<T> {
  const store = await readStore();
  const result = await mutator(store);
  await writeStore(store);
  return result;
}

export { id, now };
