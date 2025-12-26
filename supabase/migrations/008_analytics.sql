-- Migration: Add page view analytics
-- Run this in Supabase SQL Editor

-- Create page_views table
CREATE TABLE IF NOT EXISTS page_views (
    id SERIAL PRIMARY KEY,
    page_path TEXT NOT NULL,
    page_title TEXT,
    referrer TEXT,
    country TEXT,
    device_type TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);

-- Create daily stats materialized view for faster queries
CREATE TABLE IF NOT EXISTS page_view_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    page_path TEXT NOT NULL,
    view_count INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    UNIQUE(date, page_path)
);

CREATE INDEX IF NOT EXISTS idx_page_view_stats_date ON page_view_stats(date);

-- Enable RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_view_stats ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage page_views" ON page_views FOR ALL USING (true);
CREATE POLICY "Service role can manage page_view_stats" ON page_view_stats FOR ALL USING (true);

-- Allow anonymous inserts for tracking
CREATE POLICY "Anyone can insert page views" ON page_views FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT INSERT ON page_views TO anon;
GRANT ALL ON page_views TO service_role;
GRANT ALL ON page_view_stats TO service_role;
GRANT USAGE, SELECT ON SEQUENCE page_views_id_seq TO anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE page_view_stats_id_seq TO service_role;
