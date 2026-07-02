import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

let supabaseInstance = null;

if (supabaseUrl && supabaseKey) {
  let sanitizedUrl = supabaseUrl.trim();
  try {
    const urlObj = new URL(sanitizedUrl);
    sanitizedUrl = urlObj.origin; // Extracts just 'https://xxxx.supabase.co'
  } catch (e) {
    // If parsing fails, fall back to trimmed value
  }
  supabaseInstance = createClient(sanitizedUrl, supabaseKey.trim());
} else {
  console.warn('WARNING: SUPABASE_URL and SUPABASE_KEY are not configured. Supabase integration is disabled, cascading back to local JSON fallback database.');
}

export const supabase = supabaseInstance;
