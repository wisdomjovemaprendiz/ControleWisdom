import { serviceClient } from "@/lib/server/client";
import { dailyAnalysisResponse } from "@/lib/server/daily";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return dailyAnalysisResponse(request, process.env.CRON_SECRET, serviceClient);
}
