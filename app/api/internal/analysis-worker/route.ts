import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { claimNextAnalysisJob } from "@/lib/store";
import { processAnalysisJob } from "@/lib/analysis-service";

export const maxDuration = 60;

export async function POST(request: Request) {
  const expected = process.env.ANALYSIS_WORKER_SECRET ?? (process.env.NEXT_PUBLIC_APP_MODE === "live" ? undefined : "demo-worker");
  const cronExpected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const supplied = request.headers.get("x-analysis-worker-secret") ?? (authorization?.startsWith("Bearer ") ? authorization.slice(7) : null) ?? new URL(request.url).searchParams.get("secret");
  if ((!expected && !cronExpected) || (supplied !== expected && supplied !== cronExpected)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const workerId = `worker-${randomUUID()}`;
  const limit = Math.min(10, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 3));
  const results: Array<{ jobId: string; status: string; error?: string }> = [];
  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextAnalysisJob(workerId);
    if (!job) break;
    const result = await processAnalysisJob(job, workerId);
    results.push({ jobId: job.id, ...result });
  }
  return NextResponse.json({ workerId, processed: results.length, results });
}

export async function GET(request: Request) { return POST(request); }
