import type { Store } from "./types";

export function organisationMetrics(store: Store, organisationId: string) {
  const submissions = store.submissions.filter((entry) => entry.organisationId === organisationId);
  const submissionIds = new Set(submissions.map((entry) => entry.id));
  const findings = store.findings.filter((entry) => submissionIds.has(entry.submissionId));
  const resolved = findings.filter((entry) => entry.status !== "open");
  const approved = submissions.filter((entry) => entry.status === "approved");
  const categoryCounts = findings.reduce<Record<string, number>>((acc, finding) => { acc[finding.category] = (acc[finding.category] ?? 0) + 1; return acc; }, {});
  const severityCounts = findings.reduce<Record<string, number>>((acc, finding) => { acc[finding.severity] = (acc[finding.severity] ?? 0) + 1; return acc; }, {});
  return {
    totalSubmissions: submissions.length,
    pendingReviews: submissions.filter((entry) => entry.status === "pending_approval" || entry.status === "ready_for_review").length,
    issuesDetected: findings.length,
    issuesResolved: resolved.length,
    approvalRate: submissions.length ? Math.round((approved.length / submissions.length) * 100) : 0,
    resolutionRate: findings.length ? Math.round((resolved.length / findings.length) * 100) : 0,
    categoryCounts,
    severityCounts,
    highRiskOpen: findings.filter((entry) => entry.status === "open" && (entry.severity === "critical" || entry.severity === "high")).length,
    falsePositiveRate: findings.length ? Math.round((findings.filter((entry) => entry.status === "false_positive").length / findings.length) * 100) : 0,
  };
}
