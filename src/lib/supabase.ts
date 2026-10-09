import { createClient } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabaseUrl, supabaseKey } from "./config";
export { isSupabaseConfigured } from "./config";
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;
