import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { organisationMetrics } from "@/lib/metrics";
export async function GET() { try { const context = await requireAuth(); const store = await readStore(); return NextResponse.json(organisationMetrics(store, context.organisation.id)); } catch { return NextResponse.json({ error: "Authentication required" }, { status: 401 }); } }
