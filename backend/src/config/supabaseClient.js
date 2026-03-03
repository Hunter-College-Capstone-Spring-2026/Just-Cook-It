const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

let supabase = null;

if (env.supabaseUrl && env.supabaseAnonKey) {
  supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
} else {
  console.warn("[supabase] Client not initialized. Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
}

module.exports = { supabase };
