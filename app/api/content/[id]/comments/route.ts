import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { id, mutateStore, now } from "@/lib/store";

const schema = z.object({ body: z.string().min(2).max(2000) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const context = await requireAuth(); const { id: submissionId } = await params; const { body } = schema.parse(await request.json()); const comment = await mutateStore((store) => { const submission = store.submissions.find((entry) => entry.id === submissionId && entry.organisationId === context.organisation.id); if (!submission) throw new Error("NOT_FOUND"); const comment = { id: id(), submissionId, contentVersionId: submission.currentVersionId, authorId: context.profile.id, body, createdAt: now() }; store.comments.unshift(comment); store.auditEvents.unshift({ id: id(), organisationId: context.organisation.id, actorId: context.profile.id, action: "comment.created", entityType: "submission", entityId: submissionId, metadata: {}, createdAt: now() }); return comment; }); return NextResponse.json({ comment }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? error.flatten() : "Unable to comment" }, { status: 400 }); } }
