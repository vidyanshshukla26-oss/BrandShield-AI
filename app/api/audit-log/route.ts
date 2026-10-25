import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { readStore } from "@/lib/store";
export async function GET() { try { const context = await requireAuth(); const store = await readStore(); const profileMap = new Map(store.profiles.map((p) => [p.id, p.name])); return NextResponse.json({ events: store.auditEvents.filter((e) => e.organisationId === context.organisation.id).map((event) => ({ ...event, actorName: profileMap.get(event.actorId) ?? "Unknown actor" })) }); } catch { return NextResponse.json({ error: "Authentication required" }, { status: 401 }); } }
