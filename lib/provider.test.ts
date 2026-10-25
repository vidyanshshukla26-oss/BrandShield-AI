import { afterEach, describe, expect, it, vi } from "vitest";
import { analyseWithConfiguredLlm, ProviderError } from "./provider";

afterEach(() => { vi.restoreAllMocks(); delete process.env.LLM_API_KEY; delete process.env.LLM_MODEL; delete process.env.LLM_MAX_ATTEMPTS; delete process.env.LLM_TIMEOUT_MS; });

const base = { body: "Our platform supports teams.", guidelines: [], facts: [], terminology: [], submissionId: "s1", versionId: "v1", analysisRunId: "a1" };

describe("configured LLM provider", () => {
  it("fails honestly when not configured", async () => { await expect(analyseWithConfiguredLlm(base)).rejects.toMatchObject({ code: "not_configured" }); });
  it("retries a transient error and validates evidence references", async () => {
    process.env.LLM_API_KEY = "test"; process.env.LLM_MODEL = "test-model"; process.env.LLM_MAX_ATTEMPTS = "2"; process.env.LLM_TIMEOUT_MS = "1000";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ findings: [{ category: "messaging", severity: "low", confidence: 0.8, excerpt: "supports teams", explanation: "Supported wording.", evidence_references: [], suggested_correction: "", human_review_required: false }] }) } }] }), { status: 200, headers: { "content-type": "application/json" } }));
    const result = await analyseWithConfiguredLlm(base);
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(result[0].category).toBe("messaging");
  });
  it("rejects unknown evidence identifiers", async () => {
    process.env.LLM_API_KEY = "test"; process.env.LLM_MODEL = "test-model";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ findings: [{ category: "messaging", severity: "low", confidence: 0.8, excerpt: "x", explanation: "x", evidence_references: [{ type: "fact", id: "forged" }], human_review_required: true }] }) } }] }), { status: 200 }));
    await expect(analyseWithConfiguredLlm(base)).rejects.toMatchObject({ code: "invalid_output" } satisfies Partial<ProviderError>);
  });
  it("times out while reading the provider response body", async () => {
    process.env.LLM_API_KEY = "test"; process.env.LLM_MODEL = "test-model"; process.env.LLM_MAX_ATTEMPTS = "1"; process.env.LLM_TIMEOUT_MS = "10";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const signal = init?.signal;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
        },
      });
      return new Response(body, { status: 200 });
    });
    await expect(analyseWithConfiguredLlm(base)).rejects.toMatchObject({ code: "timeout" });
  });
});
