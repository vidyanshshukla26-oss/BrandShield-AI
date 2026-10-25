import "server-only";
import sharp from "sharp";
import { analyseImageWithConfiguredVision, liveVisionProviderConfigured } from "./provider";

export interface VisualCheck {
  category: "visual_consistency" | "accessibility";
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  explanation: string;
  humanReviewRequired: boolean;
}

function rgbToHex(red: number, green: number, blue: number) { return `#${[red, green, blue].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`; }
function relativeLuminance(red: number, green: number, blue: number) { const values = [red, green, blue].map((value) => { const channel = value / 255; return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; }); return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]; }

export async function deterministicImageAnalysis(buffer: Buffer, mimeType: string, approvedPalette: string[] = []) {
  const image = sharp(buffer, { failOn: "error" });
  const metadata = await image.metadata();
  const stats = await image.stats();
  const dominant = stats.channels.slice(0, 3).map((channel) => channel.mean);
  const dominantHex = rgbToHex(dominant[0] ?? 0, dominant[1] ?? 0, dominant[2] ?? 0);
  const brightness = relativeLuminance(dominant[0] ?? 0, dominant[1] ?? 0, dominant[2] ?? 0);
  const paletteDistances = approvedPalette.map((hex) => { const cleaned = hex.replace("#", ""); if (!/^[0-9a-f]{6}$/i.test(cleaned)) return Number.POSITIVE_INFINITY; const target = [0, 2, 4].map((offset) => Number.parseInt(cleaned.slice(offset, offset + 2), 16)); return Math.sqrt(target.reduce((sum, value, index) => sum + (value - dominant[index]) ** 2, 0)); });
  const closestPaletteDistance = paletteDistances.length ? Math.min(...paletteDistances) : null;
  const findings: VisualCheck[] = [];
  if (closestPaletteDistance !== null && closestPaletteDistance > 85) findings.push({ category: "visual_consistency", severity: "medium", confidence: 0.74, explanation: `The dominant image colour ${dominantHex} is notably different from the closest configured brand colour. Similarity does not prove that an asset is unauthorised.`, humanReviewRequired: true });
  if (brightness < 0.08 || brightness > 0.92) findings.push({ category: "accessibility", severity: "low", confidence: 0.68, explanation: "The dominant image tone is near an extreme brightness level. Text contrast cannot be proven without locating text and background regions; human review is required.", humanReviewRequired: true });
  if (!metadata.width || !metadata.height) findings.push({ category: "accessibility", severity: "low", confidence: 0.99, explanation: "Image dimensions could not be read reliably.", humanReviewRequired: true });
  findings.push({ category: "accessibility", severity: "low", confidence: 0.45, explanation: "Automated analysis did not inspect alternative text because it is metadata supplied outside the image bytes. Provide and review alt text before publication.", humanReviewRequired: true });
  return { metadata: { width: metadata.width ?? null, height: metadata.height ?? null, format: metadata.format ?? mimeType, hasAlpha: Boolean(metadata.hasAlpha), dominantHex, brightness: Number(brightness.toFixed(4)), closestPaletteDistance: closestPaletteDistance === null ? null : Number(closestPaletteDistance.toFixed(2)) }, findings };
}

export async function analyseImage(buffer: Buffer, mimeType: string, context: string, approvedPalette: string[] = []) {
  const deterministic = await deterministicImageAnalysis(buffer, mimeType, approvedPalette);
  if (!liveVisionProviderConfigured()) return { mode: "deterministic", ...deterministic };
  const visionFindings = await analyseImageWithConfiguredVision({ buffer, mimeType, context });
  return { mode: "vision+deterministic", ...deterministic, findings: [...deterministic.findings, ...visionFindings.map((finding) => ({ category: finding.category === "accessibility" ? "accessibility" as const : "visual_consistency" as const, severity: finding.severity, confidence: finding.confidence, explanation: finding.explanation, humanReviewRequired: finding.human_review_required }))] };
}
