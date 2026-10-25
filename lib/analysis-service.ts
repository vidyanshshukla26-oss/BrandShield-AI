import "server-only";
import { analyzeText, validateEvidenceReferences } from "./analysis";
import { analyseWithConfiguredLlm, liveTextProviderConfigured, ProviderError } from "./provider";
import { id, mutateStore, now, readStore } from "./store";
import { hasBlockingFindings } from "./workflow";
import type { AnalysisJob, Finding } from "./types";

export async function enqueueAnalysis(input: { organisationId: string; submissionId: string; contentVersionId: string; actorId: string }) {
  return mutateStore((store) => {
    const existing = store.analysisJobs.find((job) => job.submissionId === input.submissionId && job.contentVersionId === input.contentVersionId && ["queued", "running", "retry"].includes(job.status));
    if (existing) return { job: existing, run: store.analysisRuns.find((run) => run.id === existing.analysisRunId) };
    const timestamp = now();
    const run = { id: id(), submissionId: input.submissionId, contentVersionId: input.contentVersionId, provider: process.env.NEXT_PUBLIC_APP_MODE === "live" ? "configured-llm" as const : "demo-deterministic" as const, status: "queued" as const, startedAt: timestamp };
    const job: AnalysisJob = { id: id(), organisationId: input.organisationId, submissionId: input.submissionId, contentVersionId: input.contentVersionId, analysisRunId: run.id, status: "queued", attempts: 0, maxAttempts: Math.min(5, Math.max(1, Number(process.env.ANALYSIS_MAX_ATTEMPTS) || 3)), runAfter: timestamp, createdAt: timestamp, updatedAt: timestamp };
    const submission = store.submissions.find((entry) => entry.id === input.submissionId);
    if (!submission) throw new Error("NOT_FOUND");
    submission.status = "analysing"; submission.updatedAt = timestamp; submission.analysisError = undefined;
    store.analysisRuns.unshift(run); store.analysisJobs.unshift(job);
    store.auditEvents.unshift({ id: id(), organisationId: input.organisationId, actorId: input.actorId, action: "analysis.queued", entityType: "submission", entityId: input.submissionId, metadata: { jobId: job.id, versionId: input.contentVersionId }, createdAt: timestamp });
    return { job, run };
  });
}

export async function processAnalysisJob(job: AnalysisJob, workerId: string) {
  const store = await readStore();
  const submission = store.submissions.find((entry) => entry.id === job.submissionId && entry.organisationId === job.organisationId);
  const version = store.versions.find((entry) => entry.id === job.contentVersionId);
  if (!submission || !version) throw new Error("Analysis job references missing content");
  const run = store.analysisRuns.find((entry) => entry.id === job.analysisRunId);
  if (!run) throw new Error("Analysis job references missing run");
  const guidelines = store.guidelines.filter((entry) => entry.organisationId === job.organisationId);
  const facts = store.facts.filter((entry) => entry.organisationId === job.organisationId);
  const terminology = store.terminology.filter((entry) => entry.organisationId === job.organisationId);
  try {
    const deterministic = analyzeText({ body: version.body, guidelines, facts, terminology, submissionId: submission.id, versionId: version.id, analysisRunId: run.id });
    let findings: Finding[] = deterministic;
    if (process.env.NEXT_PUBLIC_APP_MODE === "live") {
      if (!liveTextProviderConfigured()) throw new ProviderError("Live mode requires LLM_API_KEY and LLM_MODEL", "not_configured");
      const liveFindings = await analyseWithConfiguredLlm({ body: version.body, guidelines, facts, terminology, submissionId: submission.id, versionId: version.id, analysisRunId: run.id });
      findings = [...deterministic, ...liveFindings];
    }
    if (!validateEvidenceReferences(findings, store)) throw new ProviderError("Analysis output contained an unknown evidence reference", "invalid_output");
    await mutateStore((current) => {
      const currentRun = current.analysisRuns.find((entry) => entry.id === job.analysisRunId); const currentJob = current.analysisJobs.find((entry) => entry.id === job.id); const currentSubmission = current.submissions.find((entry) => entry.id === job.submissionId);
      if (!currentRun || !currentJob || !currentSubmission) throw new Error("Analysis job disappeared");
      current.findings = current.findings.filter((entry) => entry.contentVersionId !== job.contentVersionId); current.findings.push(...findings);
      currentRun.status = "completed"; currentRun.completedAt = now(); currentRun.error = undefined; currentJob.status = "completed"; currentJob.updatedAt = now(); currentJob.lockedAt = undefined; currentJob.lockedBy = undefined; currentSubmission.status = hasBlockingFindings(findings) ? "needs_changes" : "ready_for_review"; currentSubmission.updatedAt = now(); currentSubmission.analysisError = undefined;
      current.auditEvents.unshift({ id: id(), organisationId: job.organisationId, actorId: currentSubmission.creatorId, action: "analysis.completed", entityType: "submission", entityId: job.submissionId, metadata: { provider: currentRun.provider, findings: findings.length, workerId }, createdAt: now() });
    });
    return { status: "completed" as const, findings: findings.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    await mutateStore((current) => {
      const currentRun = current.analysisRuns.find((entry) => entry.id === job.analysisRunId); const currentJob = current.analysisJobs.find((entry) => entry.id === job.id); const currentSubmission = current.submissions.find((entry) => entry.id === job.submissionId);
      if (!currentRun || !currentJob || !currentSubmission) return;
      currentRun.status = "failed"; currentRun.error = message; currentRun.completedAt = now(); currentJob.lastError = message; currentJob.lockedAt = undefined; currentJob.lockedBy = undefined; currentJob.status = currentJob.attempts < currentJob.maxAttempts ? "retry" : "failed"; currentJob.runAfter = new Date(Date.now() + Math.min(60_000, 2 ** currentJob.attempts * 1_000)).toISOString(); currentJob.updatedAt = now(); currentSubmission.status = currentJob.status === "retry" ? "analysing" : "analysis_failed"; currentSubmission.analysisError = message; currentSubmission.updatedAt = now(); current.auditEvents.unshift({ id: id(), organisationId: job.organisationId, actorId: currentSubmission.creatorId, action: "analysis.failed", entityType: "submission", entityId: job.submissionId, metadata: { error: message, attempts: currentJob.attempts }, createdAt: now() });
    });
    return { status: "failed" as const, error: message };
  }
}
