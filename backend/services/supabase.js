import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

let supabaseInstance = null;

if (supabaseUrl && supabaseKey) {
  supabaseInstance = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('WARNING: SUPABASE_URL and SUPABASE_KEY are not configured. Supabase integration is disabled, cascading back to local JSON fallback database.');
}

export const supabase = supabaseInstance;
