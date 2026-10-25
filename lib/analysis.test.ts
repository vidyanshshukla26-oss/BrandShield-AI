import { describe, expect, it } from "vitest";
import { analyzeText, applyCorrection, findingSchema } from "./analysis";

const guideline = { id: "g1", organisationId: "o1", title: "Evidence first", category: "Messaging", body: "No unsupported claims", status: "approved" as const, version: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
describe("ClaimGuard analysis", () => {
  it("flags guarantee and quantified promises with evidence references", () => { const findings = analyzeText({ body: "Our platform guarantees 300% growth in 14 days.", guidelines: [guideline], facts: [], terminology: [], submissionId: "s1", versionId: "v1", analysisRunId: "a1" }); expect(findings.length).toBe(2); expect(findings[0].evidenceReferences[0].id).toBe("g1"); expect(findings.some((finding) => finding.severity === "critical")).toBe(true); });
  it("validates structured findings and applies only an exact correction", () => { const finding = findingSchema.parse({ category: "unsupported_claim", severity: "high", confidence: .9, excerpt: "guarantees growth", explanation: "Unsupported", evidenceReferences: [], suggestedCorrection: "supports growth", humanReviewRequired: true, status: "open" }); expect(finding.status).toBe("open"); expect(applyCorrection("This guarantees growth.", "guarantees growth", "supports growth")).toBe("This supports growth."); expect(applyCorrection("Nothing matches", "guarantees growth", "supports growth")).toBe("Nothing matches"); });
});
