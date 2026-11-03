import { createClient } from "@supabase/supabase-js";
export function serviceClient() {
  if (typeof window !== "undefined")
    throw new Error("Operação exclusiva do servidor.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SERVER_NOT_CONFIGURED");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
