import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { deterministicImageAnalysis } from "./visual";

describe("VisualGuard deterministic analysis", () => {
  it("extracts image metadata, dominant colour, and review flags", async () => {
    const image = await sharp({ create: { width: 20, height: 10, channels: 3, background: { r: 240, g: 240, b: 240 } } }).png().toBuffer();
    const result = await deterministicImageAnalysis(image, "image/png", ["#101B33"]);
    expect(result.metadata.width).toBe(20); expect(result.metadata.height).toBe(10); expect(result.metadata.dominantHex).toBe("#f0f0f0"); expect(result.findings.some((finding) => finding.category === "accessibility")).toBe(true);
  });
});
