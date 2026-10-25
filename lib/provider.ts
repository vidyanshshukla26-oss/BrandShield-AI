import "server-only";
import { z } from "zod";
import type { ApprovedFact, BrandGuideline, Finding, TerminologyRule } from "./types";
import { id, now } from "./utils";

const providerFindingSchema = z.object({
  category: z.enum(["factual_consistency", "unsupported_claim", "terminology", "tone_voice", "messaging", "accessibility", "missing_disclaimer", "potentially_misleading"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  confidence: z.number().min(0).max(1),
  excerpt: z.string().min(1),
  explanation: z.string().min(1),
  evidence_references: z.array(z.object({ type: z.enum(["guideline", "fact", "terminology"]), id: z.string(), label: z.string().optional(), version: z.number().optional() })),
  suggested_correction: z.string().optional(),
  human_review_required: z.boolean(),
});

const providerOutputSchema = z.object({ findings: z.array(providerFindingSchema) });
type ProviderOutput = z.infer<typeof providerOutputSchema>;

export class ProviderError extends Error {
  constructor(message: string, public readonly code: "not_configured" | "timeout" | "rate_limited" | "upstream" | "invalid_output") { super(message); }
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function providerConfig(kind: "text" | "vision") {
  const apiKey = process.env.LLM_API_KEY;
  const model = kind === "vision" ? process.env.VISION_MODEL : process.env.LLM_MODEL;
  if (!apiKey || !model) throw new ProviderError(`${kind === "vision" ? "Vision" : "LLM"} provider is not configured`, "not_configured");
  return { apiKey, model, baseUrl: (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "") };
}

async function fetchWithRetry(url: string, init: RequestInit, kind: "text" | "vision") {
  const attempts = Math.min(5, numberEnv("LLM_MAX_ATTEMPTS", 3));
  const timeoutMs = numberEnv("LLM_TIMEOUT_MS", 30_000);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
      if (response.ok) return await response.text();
      const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
      if (!retryable || attempt === attempts) {
        throw new ProviderError(`${kind} provider returned HTTP ${response.status}`, response.status === 429 ? "rate_limited" : "upstream");
      }
      await response.body?.cancel();
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (attempt === attempts) {
        if (controller.signal.aborted) throw new ProviderError(`${kind} provider timed out after ${timeoutMs}ms`, "timeout");
        throw new ProviderError(`${kind} provider request failed`, "upstream");
      }
    } finally { clearTimeout(timer); }
    await new Promise((resolve) => setTimeout(resolve, Math.min(2_000, 250 * 2 ** (attempt - 1))));
  }
  throw new ProviderError(`${kind} provider request failed`, "upstream");
}

function parseProviderResponse(body: string, kind: "text" | "vision") {
  try {
    return JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> };
  } catch {
    throw new ProviderError(`${kind} provider returned invalid JSON`, "invalid_output");
  }
}

function evidenceContext(guidelines: BrandGuideline[], facts: ApprovedFact[], terminology: TerminologyRule[]) {
  return JSON.stringify({ guidelines: guidelines.filter((entry) => entry.status === "approved").map(({ id, title, body, version }) => ({ id, title, body, version })), facts: facts.filter((entry) => entry.status === "approved" && (!entry.reviewDate || new Date(entry.reviewDate).getTime() > Date.now())).map(({ id, name, value, description, version }) => ({ id, name, value, description, version })), terminology: terminology.filter((entry) => entry.status === "approved").map(({ id, preferred, prohibited, explanation }) => ({ id, preferred, prohibited, explanation })) });
}

export async function analyseWithConfiguredLlm(input: { body: string; guidelines: BrandGuideline[]; facts: ApprovedFact[]; terminology: TerminologyRule[]; submissionId: string; versionId: string; analysisRunId: string }): Promise<Finding[]> {
  const config = providerConfig("text");
  const system = [
    "You are BrandShield ClaimGuard. Review content against the supplied approved evidence.",
    "Return JSON only with shape {findings:[...]}. Never invent sources or IDs.",
    "If a claim lacks supporting evidence, classify it as unsupported_claim or potentially_misleading and use an empty evidence_references array; do not call it objectively false.",
    "Use only evidence IDs present in the supplied knowledge base. Confidence is an estimate of the analysis quality, not truth probability.",
    `Approved knowledge base: ${evidenceContext(input.guidelines, input.facts, input.terminology)}`,
  ].join("\n\n");
  const responseFormat = process.env.LLM_RESPONSE_FORMAT === "json_object" ? { type: "json_object" } : { type: "json_schema", json_schema: { name: "brandshield_findings", strict: true, schema: { type: "object", additionalProperties: false, properties: { findings: { type: "array", items: { type: "object", additionalProperties: false, properties: { category: { type: "string", enum: ["factual_consistency", "unsupported_claim", "terminology", "tone_voice", "messaging", "accessibility", "missing_disclaimer", "potentially_misleading"] }, severity: { type: "string", enum: ["critical", "high", "medium", "low"] }, confidence: { type: "number", minimum: 0, maximum: 1 }, excerpt: { type: "string" }, explanation: { type: "string" }, evidence_references: { type: "array", items: { type: "object", additionalProperties: false, properties: { type: { type: "string", enum: ["guideline", "fact", "terminology"] }, id: { type: "string" }, label: { type: ["string", "null"] }, version: { type: ["number", "null"] } }, required: ["type", "id", "label", "version"] } }, suggested_correction: { type: ["string", "null"] }, human_review_required: { type: "boolean" } }, required: ["category", "severity", "confidence", "excerpt", "explanation", "evidence_references", "suggested_correction", "human_review_required"] } } }, required: ["findings"] } } };
  const response = await fetchWithRetry(`${config.baseUrl}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model: config.model, temperature: 0, response_format: responseFormat, messages: [{ role: "system", content: system }, { role: "user", content: input.body }] }) }, "text");
  const payload = parseProviderResponse(response, "text");
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) throw new ProviderError("LLM provider returned no content", "invalid_output");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new ProviderError("LLM provider returned invalid JSON", "invalid_output"); }
  let output: ProviderOutput;
  try { output = providerOutputSchema.parse(parsed); } catch { throw new ProviderError("LLM provider output failed schema validation", "invalid_output"); }
  const validSources = new Map<string, { type: "guideline" | "fact" | "terminology"; label: string; version?: number }>([
    ...input.guidelines.map((entry) => [entry.id, { type: "guideline" as const, label: entry.title, version: entry.version }] as const),
    ...input.facts.map((entry) => [entry.id, { type: "fact" as const, label: entry.name, version: entry.version }] as const),
    ...input.terminology.map((entry) => [entry.id, { type: "terminology" as const, label: `Prefer ${entry.preferred}` }] as const),
  ]);
  if (output.findings.some((finding) => finding.evidence_references.some((reference) => { const known = validSources.get(reference.id); return !known || known.type !== reference.type; }))) throw new ProviderError("LLM provider cited an unknown or mismatched evidence ID", "invalid_output");
  return output.findings.map((finding) => ({ id: id(), submissionId: input.submissionId, analysisRunId: input.analysisRunId, contentVersionId: input.versionId, category: finding.category, severity: finding.severity, confidence: finding.confidence, excerpt: finding.excerpt, explanation: finding.explanation, evidenceReferences: finding.evidence_references.map((reference) => ({ type: reference.type, id: reference.id, label: validSources.get(reference.id)?.label ?? reference.label ?? reference.id, version: validSources.get(reference.id)?.version })), suggestedCorrection: finding.suggested_correction, humanReviewRequired: finding.human_review_required, status: "open" as const, createdAt: now() }));
}

export async function analyseImageWithConfiguredVision(input: { buffer: Buffer; mimeType: string; context: string }) {
  const config = providerConfig("vision");
  const response = await fetchWithRetry(`${config.baseUrl}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model: config.model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "You are BrandShield VisualGuard. Return JSON only: {findings:[{category,severity,confidence,explanation,human_review_required}]} . Do not claim full accessibility compliance. Mark uncertain visual judgements for human review." }, { role: "user", content: [{ type: "text", text: input.context }, { type: "image_url", image_url: { url: `data:${input.mimeType};base64,${input.buffer.toString("base64")}` } }] }] }) }, "vision");
  const payload = parseProviderResponse(response, "vision");
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) throw new ProviderError("Vision provider returned no content", "invalid_output");
  try { return z.object({ findings: z.array(z.object({ category: z.string(), severity: z.enum(["critical", "high", "medium", "low"]), confidence: z.number().min(0).max(1), explanation: z.string(), human_review_required: z.boolean() })) }).parse(JSON.parse(raw)).findings; } catch { throw new ProviderError("Vision provider output failed schema validation", "invalid_output"); }
}

export function liveTextProviderConfigured() { return Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL); }
export function liveVisionProviderConfigured() { return Boolean(process.env.LLM_API_KEY && process.env.VISION_MODEL); }
