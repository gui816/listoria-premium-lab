import { createClient } from "@supabase/supabase-js";

// The publishable key is intended for client-side use. Keep database access
// protected by the RLS policies and RPC permissions defined in the migration.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://wczehxiveifxmdcxxiqw.supabase.co";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_VRkR4ioSpujYazmYXk1WEA_h9LRHArV";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      realtime: { params: { eventsPerSecond: 5 } }
    })
  : null;
