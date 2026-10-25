import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { id, mutateStore, now } from "@/lib/store";
import { analyseImage } from "@/lib/visual";
import { ProviderError } from "@/lib/provider";

const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const context = await requireAuth(); const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "An image file is required" }, { status: 400 });
    if (!allowed.has(file.type)) return NextResponse.json({ error: "Unsupported image type. Use PNG, JPEG, WebP, or GIF." }, { status: 415 });
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Images must be 8 MB or smaller." }, { status: 413 });
    const buffer = Buffer.from(await file.arrayBuffer()); const signature = buffer.subarray(0, 12).toString("hex");
    const supportedSignature = signature.startsWith("89504e47") || signature.startsWith("ffd8ff") || signature.startsWith("52494646") || signature.startsWith("47494638");
    if (!supportedSignature) return NextResponse.json({ error: "The file signature does not match a supported image." }, { status: 400 });
    const approvedPalette = (process.env.BRAND_PALETTE ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    const analysis = await analyseImage(buffer, file.type, "Check logo usage, visual consistency, likely text readability issues, and alt-text risks. Treat uncertain judgements as requiring human review.", approvedPalette);
    const asset = await mutateStore((store) => {
      const item = { id: id(), organisationId: context.organisation.id, name: file.name, kind: "reference" as const, fileName: file.name, mimeType: file.type, sizeBytes: file.size, usageNotes: "Uploaded for VisualGuard checks. Private object storage is required for production deployment.", metadata: analysis.metadata, createdAt: now() };
      store.assets.unshift(item); store.auditEvents.unshift({ id: id(), organisationId: context.organisation.id, actorId: context.profile.id, action: "visual_asset.analyzed", entityType: "brand_asset", entityId: item.id, metadata: { mode: analysis.mode, mimeType: file.type, bytes: file.size }, createdAt: now() }); return item;
    });
    return NextResponse.json({ mode: analysis.mode, asset, findings: analysis.findings }, { status: 201 });
  } catch (error) {
    if (error instanceof ProviderError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === "not_configured" ? 503 : 502 });
    return NextResponse.json({ error: "Visual analysis failed" }, { status: 400 });
  }
}
