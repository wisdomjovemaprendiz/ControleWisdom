import { serviceClient } from "@/lib/server/client";
import {
  authorizedProfile,
  createTeamAccount,
  updateTeamAccount,
  resetTeamPassword,
  apiFailure,
  jsonInput,
} from "@/lib/server/team";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const client = serviceClient();
    const { profile } = await authorizedProfile(request, client);
    const input = await jsonInput(request);
    if (input.action === "reset_password") {
      await resetTeamPassword(client, profile.id, input);
      return Response.json(
        { ok: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const account = await createTeamAccount(client, profile.id, input);
    return Response.json(
      { profile: account },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const client = serviceClient();
    const { profile } = await authorizedProfile(request, client);
    const account = await updateTeamAccount(
      client,
      profile.id,
      await jsonInput(request),
    );
    return Response.json(
      { profile: account },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
