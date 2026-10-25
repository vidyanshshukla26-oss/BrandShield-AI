import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { readStore } from "@/lib/store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const context = await requireAuth(); const { id } = await params; const store = await readStore(); const submission = store.submissions.find((entry) => entry.id === id && entry.organisationId === context.organisation.id); if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 }); return NextResponse.json({ submission, version: store.versions.find((entry) => entry.id === submission.currentVersionId), versions: store.versions.filter((entry) => entry.submissionId === id).sort((a, b) => b.version - a.version), findings: store.findings.filter((entry) => entry.submissionId === id), comments: store.comments.filter((entry) => entry.submissionId === id), decisions: store.decisions.filter((entry) => entry.submissionId === id), profiles: store.profiles }); } catch { return NextResponse.json({ error: "Authentication required" }, { status: 401 }); }
}
