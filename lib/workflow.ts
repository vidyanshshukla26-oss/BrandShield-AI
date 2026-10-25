import type { SubmissionStatus } from "./types";

const transitions: Record<SubmissionStatus, SubmissionStatus[]> = {
  draft: ["analysing"],
  analysing: ["needs_changes", "ready_for_review", "analysis_failed"],
  needs_changes: ["analysing", "ready_for_review"],
  ready_for_review: ["pending_approval", "needs_changes"],
  pending_approval: ["approved", "rejected", "needs_changes"],
  approved: ["needs_changes", "analysing"],
  rejected: ["analysing", "draft"],
  analysis_failed: ["analysing", "draft"],
};

export function canTransition(from: SubmissionStatus, to: SubmissionStatus) {
  return transitions[from].includes(to);
}

export function assertTransition(from: SubmissionStatus, to: SubmissionStatus) {
  if (!canTransition(from, to)) throw new Error(`Invalid transition: ${from} -> ${to}`);
}

export function hasBlockingFindings(findings: { status: string; humanReviewRequired: boolean; severity: string }[]) {
  return findings.some((finding) => finding.status === "open" && (finding.humanReviewRequired || finding.severity === "critical" || finding.severity === "high"));
}
