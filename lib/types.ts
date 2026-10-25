export type Role = "owner" | "brand_manager" | "creator" | "reviewer";
export type SubmissionStatus =
  | "draft"
  | "analysing"
  | "needs_changes"
  | "ready_for_review"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "analysis_failed";
export type Severity = "critical" | "high" | "medium" | "low";
export type FindingStatus = "open" | "accepted" | "rejected" | "false_positive" | "clarification_requested";
export type FindingCategory =
  | "factual_consistency"
  | "unsupported_claim"
  | "terminology"
  | "tone_voice"
  | "messaging"
  | "accessibility"
  | "missing_disclaimer"
  | "potentially_misleading";

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  mode: "demo" | "live";
  createdAt: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface OrganisationMember {
  id: string;
  organisationId: string;
  profileId: string;
  role: Role;
  joinedAt: string;
}

export interface BrandGuideline {
  id: string;
  organisationId: string;
  title: string;
  category: string;
  body: string;
  status: "draft" | "approved" | "archived";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovedFact {
  id: string;
  organisationId: string;
  name: string;
  value: string;
  description: string;
  source: string;
  sourceUrl?: string;
  verifiedAt: string;
  reviewDate?: string;
  status: "draft" | "approved" | "expired" | "archived";
  version: number;
}

export interface TerminologyRule {
  id: string;
  organisationId: string;
  preferred: string;
  prohibited?: string;
  explanation: string;
  status: "approved" | "draft" | "archived";
}

export interface BrandAsset {
  id: string;
  organisationId: string;
  name: string;
  kind: "logo" | "graphic" | "reference";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  usageNotes: string;
  createdAt: string;
}

export interface ContentSubmission {
  id: string;
  organisationId: string;
  title: string;
  contentType: "blog" | "social" | "email" | "ad" | "web" | "other";
  campaign?: string;
  targetAudience?: string;
  channel?: string;
  deadline?: string;
  priority: "normal" | "high" | "urgent";
  status: SubmissionStatus;
  creatorId: string;
  assignedReviewerId?: string;
  currentVersionId: string;
  createdAt: string;
  updatedAt: string;
  analysisError?: string;
}

export interface ContentVersion {
  id: string;
  submissionId: string;
  version: number;
  body: string;
  createdBy: string;
  createdAt: string;
  changeNote?: string;
}

export interface AnalysisRun {
  id: string;
  submissionId: string;
  contentVersionId: string;
  provider: "demo-deterministic" | "configured-llm";
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface EvidenceReference {
  type: "guideline" | "fact" | "terminology";
  id: string;
  label: string;
  version?: number;
}

export interface Finding {
  id: string;
  submissionId: string;
  analysisRunId: string;
  contentVersionId: string;
  category: FindingCategory;
  severity: Severity;
  confidence: number;
  excerpt: string;
  explanation: string;
  evidenceReferences: EvidenceReference[];
  suggestedCorrection?: string;
  humanReviewRequired: boolean;
  status: FindingStatus;
  createdAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface ReviewComment {
  id: string;
  submissionId: string;
  contentVersionId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface ApprovalDecision {
  id: string;
  submissionId: string;
  contentVersionId: string;
  reviewerId: string;
  decision: "approved" | "rejected" | "changes_requested";
  note?: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  organisationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface Store {
  organisations: Organisation[];
  profiles: Profile[];
  members: OrganisationMember[];
  guidelines: BrandGuideline[];
  facts: ApprovedFact[];
  terminology: TerminologyRule[];
  assets: BrandAsset[];
  submissions: ContentSubmission[];
  versions: ContentVersion[];
  analysisRuns: AnalysisRun[];
  findings: Finding[];
  comments: ReviewComment[];
  decisions: ApprovalDecision[];
  auditEvents: AuditEvent[];
}

export interface AuthContext {
  profile: Profile;
  organisation: Organisation;
  member: OrganisationMember;
}
