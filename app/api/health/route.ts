import { NextResponse } from "next/server";
import { runHealthCheck } from "@/services/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await runHealthCheck();
  const httpStatus = result.status === "ok" ? 200 : result.status === "degraded" ? 200 : 503;

  return NextResponse.json(result, { status: httpStatus });
}
