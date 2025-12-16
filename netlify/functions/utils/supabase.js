/**
 * Supabase Client Utility
 * Shared client for all serverless functions
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Public client (respects RLS policies)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (bypasses RLS - use for server-side operations)
const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabase;

module.exports = { supabase, supabaseAdmin };
