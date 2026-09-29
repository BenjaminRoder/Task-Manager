import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

export function browserClient() {
  const config = supabaseConfig();
  if (!config)
    throw new Error(
      "Supabase is not configured. Follow README.md to add the environment variables.",
    );
  return createBrowserClient(config.url, config.key);
}
