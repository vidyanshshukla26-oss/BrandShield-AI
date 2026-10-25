import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { id, mutateStore, now } from "@/lib/store";

const submissionSchema = z.object({ title: z.string().min(2), contentType: z.enum(["blog", "social", "email", "ad", "web", "other"]), body: z.string().min(20), campaign: z.string().optional(), targetAudience: z.string().optional(), channel: z.string().optional(), deadline: z.string().optional(), priority: z.enum(["normal", "high", "urgent"]).default("normal") });

export async function GET() {
  try { const context = await requireAuth(); const store = await import("@/lib/store").then((module) => module.readStore()); return NextResponse.json({ submissions: store.submissions.filter((entry) => entry.organisationId === context.organisation.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }); } catch { return NextResponse.json({ error: "Authentication required" }, { status: 401 }); }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuth();
    const input = submissionSchema.parse(await request.json());
    const submission = await mutateStore((store) => {
      const submissionId = id(); const versionId = id(); const timestamp = now();
      store.submissions.unshift({ id: submissionId, organisationId: context.organisation.id, title: input.title, contentType: input.contentType, campaign: input.campaign, targetAudience: input.targetAudience, channel: input.channel, deadline: input.deadline, priority: input.priority, status: "draft", creatorId: context.profile.id, currentVersionId: versionId, createdAt: timestamp, updatedAt: timestamp });
      store.versions.push({ id: versionId, submissionId, version: 1, body: input.body, createdBy: context.profile.id, createdAt: timestamp });
      store.auditEvents.unshift({ id: id(), organisationId: context.organisation.id, actorId: context.profile.id, action: "submission.created", entityType: "submission", entityId: submissionId, metadata: { version: 1 }, createdAt: timestamp });
      return store.submissions[0];
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? error.flatten() : "Unable to create submission" }, { status: 400 }); }
}
