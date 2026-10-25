import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enqueueAnalysis } from "@/lib/analysis-service";
import { assertTransition } from "@/lib/workflow";
import { readStore } from "@/lib/store";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuth();
    const { id: submissionId } = await params;
    const store = await readStore();
    const submission = store.submissions.find((entry) => entry.id === submissionId && entry.organisationId === context.organisation.id);
    if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!["draft", "needs_changes", "analysis_failed", "approved"].includes(submission.status)) return NextResponse.json({ error: `Cannot analyse a submission in ${submission.status} status` }, { status: 409 });
    assertTransition(submission.status, "analysing");
    const version = store.versions.find((entry) => entry.id === submission.currentVersionId);
    if (!version) return NextResponse.json({ error: "Current content version not found" }, { status: 409 });
    const queued = await enqueueAnalysis({ organisationId: context.organisation.id, submissionId, contentVersionId: version.id, actorId: context.profile.id });
    return NextResponse.json({ ...queued, message: "Analysis queued. A background worker will process this submission." }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to queue analysis" }, { status: 400 });
  }
}
