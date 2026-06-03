import { NextResponse } from "next/server";
import { runReadyCheck } from "@/services/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await runReadyCheck();
  const httpStatus = result.status === "ok" ? 200 : 503;

  return NextResponse.json(result, { status: httpStatus });
}
