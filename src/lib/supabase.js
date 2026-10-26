import { createClient } from "@supabase/supabase-js";

// Lab isolation: never fall back to the Listora production project.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, { realtime: { params: { eventsPerSecond: 5 } } })
  : null;
