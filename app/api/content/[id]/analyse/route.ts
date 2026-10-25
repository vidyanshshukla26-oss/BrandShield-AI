import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { analyzeText, validateEvidenceReferences } from "@/lib/analysis";
import { id, mutateStore, now } from "@/lib/store";
import { assertTransition, hasBlockingFindings } from "@/lib/workflow";
import type { AnalysisRun } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuth(); const { id: submissionId } = await params;
    const result = await mutateStore((store) => {
      const submission = store.submissions.find((entry) => entry.id === submissionId && entry.organisationId === context.organisation.id); if (!submission) throw new Error("NOT_FOUND");
      const version = store.versions.find((entry) => entry.id === submission.currentVersionId); if (!version) throw new Error("VERSION_NOT_FOUND");
      if (submission.status !== "draft" && submission.status !== "needs_changes" && submission.status !== "analysis_failed" && submission.status !== "approved") throw new Error("INVALID_STATUS");
      assertTransition(submission.status, "analysing");
      submission.status = "analysing"; submission.updatedAt = now();
      const run: AnalysisRun = { id: id(), submissionId, contentVersionId: version.id, provider: "demo-deterministic", status: "running", startedAt: now() };
      store.analysisRuns.unshift(run);
      const findings = analyzeText({ body: version.body, guidelines: store.guidelines.filter((entry) => entry.organisationId === context.organisation.id), facts: store.facts.filter((entry) => entry.organisationId === context.organisation.id), terminology: store.terminology.filter((entry) => entry.organisationId === context.organisation.id), submissionId, versionId: version.id, analysisRunId: run.id });
      if (!validateEvidenceReferences(findings, store)) throw new Error("INVALID_EVIDENCE");
      store.findings = store.findings.filter((entry) => entry.contentVersionId !== version.id);
      store.findings.push(...findings); run.status = "completed"; run.completedAt = now(); submission.status = hasBlockingFindings(findings) ? "needs_changes" : "ready_for_review"; submission.updatedAt = now();
      store.auditEvents.unshift({ id: id(), organisationId: context.organisation.id, actorId: context.profile.id, action: "analysis.completed", entityType: "submission", entityId: submissionId, metadata: { provider: run.provider, findings: findings.length }, createdAt: now() });
      return { submission, findings, provider: run.provider };
    });
    return NextResponse.json(result);
  } catch (error) { const message = error instanceof Error ? error.message : "Analysis failed"; const status = message === "NOT_FOUND" ? 404 : 400; return NextResponse.json({ error: message }, { status }); }
}
