-- ============================================
-- EVALIS AI — Analytics & AI Chat Tables
-- Migration: 023_analytics_ai_tables.sql
-- ============================================

-- Analytics tracking table
CREATE TABLE IF NOT EXISTS public.analytics (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event TEXT NOT NULL DEFAULT 'pageview',
    visitor_id TEXT,
    session_id TEXT,
    page TEXT,
    referrer TEXT,
    device TEXT,
    browser TEXT,
    screen_w INT DEFAULT 0,
    screen_h INT DEFAULT 0,
    lang TEXT,
    duration_seconds INT DEFAULT 0,
    scroll_depth INT DEFAULT 0,
    cta_text TEXT,
    cta_href TEXT,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI chat logs table
CREATE TABLE IF NOT EXISTS public.ai_chats (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    visitor_ip TEXT,
    user_message TEXT,
    ai_response TEXT,
    page TEXT DEFAULT '/',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_event ON public.analytics(event);
CREATE INDEX IF NOT EXISTS idx_analytics_page ON public.analytics(page);
CREATE INDEX IF NOT EXISTS idx_analytics_visitor ON public.analytics(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON public.analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON public.analytics(session_id);

-- Indexes for AI chats
CREATE INDEX IF NOT EXISTS idx_ai_chats_created ON public.ai_chats(created_at DESC);

-- Grant access for Supabase Data API
GRANT ALL ON public.analytics TO anon, authenticated, service_role;
GRANT ALL ON public.ai_chats TO anon, authenticated, service_role;

-- Enable RLS
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;

-- RLS policies — allow insert from anon (for tracking), select for authenticated
CREATE POLICY "Allow anon insert analytics" ON public.analytics FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert ai_chats" ON public.ai_chats FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow service_role full access analytics" ON public.analytics FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service_role full access ai_chats" ON public.ai_chats FOR ALL TO service_role USING (true);
CREATE POLICY "Allow authenticated read analytics" ON public.analytics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read ai_chats" ON public.ai_chats FOR SELECT TO authenticated USING (true);
