-- ============================================
-- EVALIS AI — SUPABASE DATABASE SETUP
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CONTRIBUTOR APPLICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS contributors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    primary_skill TEXT NOT NULL,
    experience TEXT NOT NULL,
    languages TEXT,
    about TEXT,
    cv_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active')),
    assigned_projects TEXT[],
    notes TEXT
);

-- ============================================
-- 2. PROJECT ENQUIRIES (Contact Form)
-- ============================================
CREATE TABLE IF NOT EXISTS enquiries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    service TEXT,
    budget TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'in_progress', 'closed')),
    notes TEXT
);

-- ============================================
-- 3. AI PROJECTS
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    tags TEXT[],
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'upcoming', 'completed', 'paused')),
    positions_available INT DEFAULT 0,
    positions_filled INT DEFAULT 0,
    pay_range TEXT,
    requirements TEXT,
    icon TEXT DEFAULT '🤖',
    banner_class TEXT DEFAULT 'pb-1',
    sort_order INT DEFAULT 0
);

-- ============================================
-- 4. NEWSLETTER / WAITLIST
-- ============================================
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    email TEXT NOT NULL UNIQUE,
    source TEXT DEFAULT 'website',
    project_interest TEXT
);

-- ============================================
-- 5. MARKETPLACE ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    product TEXT NOT NULL,
    amount DECIMAL(10,2),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'delivered', 'cancelled')),
    notes TEXT
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Public can INSERT into contributors, enquiries, waitlist (form submissions)
CREATE POLICY "Allow public inserts" ON contributors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public inserts" ON enquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public inserts" ON waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public inserts" ON orders FOR INSERT WITH CHECK (true);

-- Public can READ projects (to display on website)
CREATE POLICY "Allow public reads" ON projects FOR SELECT USING (true);

-- Only authenticated users (admin) can read all data
CREATE POLICY "Admin reads contributors" ON contributors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin reads enquiries" ON enquiries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin reads waitlist" ON waitlist FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin reads orders" ON orders FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- SEED: INSERT DEFAULT PROJECTS
-- ============================================
INSERT INTO projects (title, description, category, tags, status, positions_available, icon, banner_class, sort_order) VALUES
('AI Voice Dubbing', 'Multilingual voice dubbing using AI voice synthesis. Evaluate dubbed audio for naturalness, emotion accuracy, and lip-sync quality across 20+ languages.', 'voice', ARRAY['Voice AI','Dubbing','Multilingual','Audio QA'], 'active', 50, '🎙️', 'pb-1', 1),
('Video Lip Syncing AI', 'Evaluate and annotate AI-generated lip sync videos. Rate sync accuracy, facial naturalness, and visual artifacts in AI-modified video content.', 'video', ARRAY['Lip Sync','Video AI','Deepfake QA','Annotation'], 'active', 30, '🎬', 'pb-2', 2),
('AI Voice Cloning Evaluation', 'Evaluate AI-cloned voices for speaker similarity, emotional range, pronunciation accuracy, and safety compliance across multiple voice profiles.', 'voice', ARRAY['Voice Clone','TTS','Safety','Evaluation'], 'active', 25, '🗣️', 'pb-3', 3),
('Image Annotation & Labeling', 'Precision labeling for computer vision models — object detection, semantic segmentation, bounding boxes, keypoints, and image classification.', 'image', ARRAY['Image AI','Object Detection','Segmentation','Labeling'], 'active', 100, '🖼️', 'pb-4', 4),
('LLM Safety & Red Teaming', 'Red-team large language models for safety, hallucination, bias, and toxicity. Expert evaluators test AI responses across sensitive categories.', 'llm', ARRAY['LLM','Red Team','Safety','Bias Detection'], 'active', 40, '🧠', 'pb-5', 5),
('Multi-Modal Data Labeling', 'Label text, audio, and video datasets for training next-gen AI models. Includes intent tagging, NER, sentiment analysis, and content classification.', 'data', ARRAY['NLP','NER','Sentiment','Multi-Modal'], 'active', 80, '📊', 'pb-6', 6),
('Search Engine Evaluation', 'Evaluate and rank search engine results for relevance, freshness, and user intent satisfaction across web, image, and video search.', 'search', ARRAY['Search QA','SERP','Relevance','Intent'], 'upcoming', 60, '🔍', 'pb-7', 7),
('AI Image Generation QA', 'Evaluate AI-generated images for prompt accuracy, visual quality, artistic coherence, and safety. Compare outputs across diffusion models.', 'image', ARRAY['Image Gen','Diffusion','Prompt QA','Comparison'], 'upcoming', 35, '🎨', 'pb-8', 8),
('AI Content Moderation', 'Review AI platform content for policy violations, harmful material, misinformation, and NSFW detection. Multilingual moderation.', 'moderation', ARRAY['Moderation','Safety','Policy','Multilingual'], 'active', 45, '🛡️', 'pb-1', 9);
