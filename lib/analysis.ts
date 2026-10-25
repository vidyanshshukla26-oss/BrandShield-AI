import { z } from "zod";
import { id, now } from "./utils";
import type { ApprovedFact, BrandGuideline, Finding, FindingCategory, Store, TerminologyRule } from "./types";

export const findingSchema = z.object({
  category: z.enum(["factual_consistency", "unsupported_claim", "terminology", "tone_voice", "messaging", "accessibility", "missing_disclaimer", "potentially_misleading"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  confidence: z.number().min(0).max(1),
  excerpt: z.string().min(1),
  explanation: z.string().min(1),
  evidenceReferences: z.array(z.object({ type: z.enum(["guideline", "fact", "terminology"]), id: z.string(), label: z.string(), version: z.number().optional() })),
  suggestedCorrection: z.string().optional(),
  humanReviewRequired: z.boolean(),
  status: z.literal("open"),
});

const claimPatterns: Array<{ pattern: RegExp; category: FindingCategory; severity: Finding["severity"]; explanation: string; correction: string }> = [
  { pattern: /\bguarantee(?:s|d)?\b[^.?!]{0,100}/i, category: "unsupported_claim", severity: "critical", explanation: "A guarantee is a high-risk promise and requires explicit approved evidence.", correction: "Use an outcome-neutral description of the product experience instead." },
  { pattern: /(?:\d+%|\d+x|\d+\s*percent)[^.?!]{0,100}/i, category: "unsupported_claim", severity: "high", explanation: "A quantified performance claim needs a current approved source.", correction: "Replace the number with a qualified, evidence-backed description or add an approved source." },
  { pattern: /\b(?:#1|number one|best|fastest|cheapest|zero risk)\b/i, category: "potentially_misleading", severity: "high", explanation: "Superlative or absolute wording may mislead without scope, methodology, and approved substantiation.", correction: "Use specific, verifiable language that explains the value without an absolute comparison." },
];

function referenceForGuideline(guidelines: BrandGuideline[]) {
  const guideline = guidelines.find((entry) => entry.status === "approved");
  return guideline ? [{ type: "guideline" as const, id: guideline.id, label: guideline.title, version: guideline.version }] : [];
}

function findTermMatch(body: string, rules: TerminologyRule[]) {
  return rules.find((rule) => rule.status === "approved" && rule.prohibited && body.toLowerCase().includes(rule.prohibited.toLowerCase()));
}

function findFactMatch(body: string, facts: ApprovedFact[]) {
  return facts.find((fact) => fact.status === "approved" && (!fact.reviewDate || new Date(fact.reviewDate).getTime() > Date.now()) && body.toLowerCase().includes(fact.name.toLowerCase()));
}

export function analyzeText(input: { body: string; guidelines: BrandGuideline[]; facts: ApprovedFact[]; terminology: TerminologyRule[]; submissionId: string; versionId: string; analysisRunId: string }): Finding[] {
  const findings: Finding[] = [];
  for (const rule of claimPatterns) {
    const match = input.body.match(rule.pattern);
    if (match) {
      findings.push({ id: id(), submissionId: input.submissionId, analysisRunId: input.analysisRunId, contentVersionId: input.versionId, category: rule.category, severity: rule.severity, confidence: rule.severity === "critical" ? 0.98 : 0.9, excerpt: match[0].trim(), explanation: rule.explanation, evidenceReferences: referenceForGuideline(input.guidelines), suggestedCorrection: rule.correction, humanReviewRequired: rule.severity === "critical" || rule.severity === "high", status: "open", createdAt: now() });
    }
  }
  const term = findTermMatch(input.body, input.terminology);
  if (term && term.prohibited) {
    findings.push({ id: id(), submissionId: input.submissionId, analysisRunId: input.analysisRunId, contentVersionId: input.versionId, category: "terminology", severity: "medium", confidence: 0.99, excerpt: term.prohibited, explanation: `${term.prohibited} is not the approved product terminology.`, evidenceReferences: [{ type: "terminology", id: term.id, label: `Prefer ${term.preferred}` }], suggestedCorrection: input.body.replace(new RegExp(term.prohibited, "gi"), term.preferred), humanReviewRequired: false, status: "open", createdAt: now() });
  }
  const fact = findFactMatch(input.body, input.facts);
  if (fact && fact.status === "approved") {
    const mentionsNumber = /\d/.test(input.body);
    if (mentionsNumber && !input.body.includes(fact.value)) {
      findings.push({ id: id(), submissionId: input.submissionId, analysisRunId: input.analysisRunId, contentVersionId: input.versionId, category: "factual_consistency", severity: "high", confidence: 0.86, excerpt: fact.name, explanation: `The approved value for this fact is “${fact.value}”. The submitted wording contains a different number or range.`, evidenceReferences: [{ type: "fact", id: fact.id, label: fact.name, version: fact.version }], suggestedCorrection: `${fact.name}: ${fact.value}.`, humanReviewRequired: true, status: "open", createdAt: now() });
    }
  }
  findings.forEach((finding) => findingSchema.parse({
    category: finding.category,
    severity: finding.severity,
    confidence: finding.confidence,
    excerpt: finding.excerpt,
    explanation: finding.explanation,
    evidenceReferences: finding.evidenceReferences,
    suggestedCorrection: finding.suggestedCorrection,
    humanReviewRequired: finding.humanReviewRequired,
    status: "open",
  }));
  return findings;
}

export function validateEvidenceReferences(findings: Finding[], store: Store) {
  const valid = new Set([...store.guidelines.map((entry) => entry.id), ...store.facts.map((entry) => entry.id), ...store.terminology.map((entry) => entry.id)]);
  return findings.every((finding) => finding.evidenceReferences.every((reference) => valid.has(reference.id)));
}

export function applyCorrection(body: string, excerpt: string, correction: string) {
  if (!excerpt.trim() || !body.includes(excerpt)) return body;
  return body.replace(excerpt, correction);
}
