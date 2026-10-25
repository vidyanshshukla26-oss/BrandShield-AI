import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { id, mutateStore, now } from "@/lib/store";

const schema = z.object({ body: z.string().min(20), changeNote: z.string().max(500).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const context = await requireAuth(); const { id: submissionId } = await params; const input = schema.parse(await request.json()); const version = await mutateStore((store) => { const submission = store.submissions.find((entry) => entry.id === submissionId && entry.organisationId === context.organisation.id); if (!submission) throw new Error("NOT_FOUND"); const nextVersion = Math.max(0, ...store.versions.filter((entry) => entry.submissionId === submissionId).map((entry) => entry.version)) + 1; const versionId = id(); const timestamp = now(); store.versions.push({ id: versionId, submissionId, version: nextVersion, body: input.body, createdBy: context.profile.id, createdAt: timestamp, changeNote: input.changeNote }); submission.currentVersionId = versionId; submission.status = "draft"; submission.updatedAt = timestamp; store.auditEvents.unshift({ id: id(), organisationId: context.organisation.id, actorId: context.profile.id, action: "revision.created", entityType: "submission", entityId: submissionId, metadata: { version: nextVersion }, createdAt: timestamp }); return store.versions.at(-1); }); return NextResponse.json({ version }); } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? error.flatten() : "Unable to create revision" }, { status: 400 }); }
}
