import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase env vars missing (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Submissions will not be persisted."
  );
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// PRIVATE bucket for ID-card scans (copie CI) uploaded by team members. Not
// publicly readable — the public form may upload, but reads require auth and
// are served via short-lived signed URLs:
//   supabase.storage.from(ECHIPA_CI_BUCKET).createSignedUrl(path, 60)
// Files are named after the person, e.g. "Andrei Popescu.jpg".
export const ECHIPA_CI_BUCKET = "echipa-ci";
